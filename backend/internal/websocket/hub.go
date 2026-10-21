package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"pulsenoc/backend/internal/ssh"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for NOC dashboard
	},
}

type Message struct {
	Event string      `json:"event"`
	Data  interface{} `json:"data"`
}

type InboundMessage struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

type Client struct {
	hub        *Hub
	conn       *websocket.Conn
	send       chan []byte
	sshSession *ssh.Session
	sshMu      sync.Mutex
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) Broadcast(event string, data interface{}) {
	msg := Message{
		Event: event,
		Data:  data,
	}
	bytes, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[WebSocket] Broadcast JSON marshal error: %v", err)
		return
	}
	h.broadcast <- bytes
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WebSocket] Upgrade error: %v", err)
		return
	}

	client := &Client{
		hub:  h,
		conn: conn,
		send: make(chan []byte, 256),
	}
	h.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) sendDirect(event string, data interface{}) {
	msg := Message{
		Event: event,
		Data:  data,
	}
	bytes, err := json.Marshal(msg)
	if err != nil {
		return
	}
	select {
	case c.send <- bytes:
	default:
	}
}

func (c *Client) readPump() {
	defer func() {
		c.closeSSHSession()
		c.hub.unregister <- c
		c.conn.Close()
	}()

	for {
		_, rawBytes, err := c.conn.ReadMessage()
		if err != nil {
			break
		}

		var inMsg InboundMessage
		if err := json.Unmarshal(rawBytes, &inMsg); err != nil {
			continue
		}

		switch inMsg.Event {
		case "ssh:connect":
			var cfg ssh.ConnectConfig
			if err := json.Unmarshal(inMsg.Data, &cfg); err != nil {
				c.sendDirect("ssh:status", map[string]interface{}{
					"status":  "ERROR",
					"message": "Invalid SSH connection payload",
				})
				continue
			}

			c.closeSSHSession()

			session, err := ssh.Connect(cfg, func(data string) {
				c.sendDirect("ssh:data", data)
			}, func(status, message, host string) {
				statusPayload := map[string]interface{}{
					"status": status,
					"host":   host,
				}
				if message != "" {
					statusPayload["message"] = message
				}
				c.sendDirect("ssh:status", statusPayload)
			})

			if err == nil {
				c.sshMu.Lock()
				c.sshSession = session
				c.sshMu.Unlock()
			}

		case "ssh:input":
			var input struct {
				Data string `json:"data"`
			}
			if err := json.Unmarshal(inMsg.Data, &input); err == nil {
				c.sshMu.Lock()
				sess := c.sshSession
				c.sshMu.Unlock()
				if sess != nil {
					_ = sess.Write(input.Data)
				}
			}

		case "ssh:disconnect":
			c.closeSSHSession()
			c.sendDirect("ssh:status", map[string]interface{}{
				"status":  "DISCONNECTED",
				"message": "SSH session closed",
			})
		}
	}
}

func (c *Client) closeSSHSession() {
	c.sshMu.Lock()
	defer c.sshMu.Unlock()
	if c.sshSession != nil {
		c.sshSession.Close()
		c.sshSession = nil
	}
}

func (c *Client) writePump() {
	defer func() {
		c.conn.Close()
	}()

	for message := range c.send {
		w, err := c.conn.NextWriter(websocket.TextMessage)
		if err != nil {
			return
		}
		if _, err := w.Write(message); err != nil {
			return
		}
		if err := w.Close(); err != nil {
			return
		}
	}
}
