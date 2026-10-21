package ssh

import (
	"fmt"
	"io"
	"net"
	"strconv"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
)

type ConnectConfig struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	Password   string `json:"password,omitempty"`
	PrivateKey string `json:"privateKey,omitempty"`
}

type Session struct {
	client  *ssh.Client
	session *ssh.Session
	stdin   io.WriteCloser
	mu      sync.Mutex
	closed  bool
}

func Connect(cfg ConnectConfig, onData func(string), onStatus func(string, string, string)) (*Session, error) {
	port := cfg.Port
	if port <= 0 {
		port = 22
	}

	var authMethods []ssh.AuthMethod
	if cfg.Password != "" {
		authMethods = append(authMethods, ssh.Password(cfg.Password))
	}
	if cfg.PrivateKey != "" {
		signer, err := ssh.ParsePrivateKey([]byte(cfg.PrivateKey))
		if err == nil {
			authMethods = append(authMethods, ssh.PublicKeys(signer))
		}
	}

	sshConfig := &ssh.ClientConfig{
		User:            cfg.Username,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	addr := net.JoinHostPort(cfg.Host, strconv.Itoa(port))
	client, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		if onStatus != nil {
			onStatus("ERROR", fmt.Sprintf("SSH connection failed: %v", err), cfg.Host)
		}
		return nil, err
	}

	session, err := client.NewSession()
	if err != nil {
		client.Close()
		if onStatus != nil {
			onStatus("ERROR", fmt.Sprintf("Failed to allocate SSH session: %v", err), cfg.Host)
		}
		return nil, err
	}

	// Pseudo terminal modes
	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}

	if err := session.RequestPty("xterm-256color", 35, 120, modes); err != nil {
		session.Close()
		client.Close()
		if onStatus != nil {
			onStatus("ERROR", fmt.Sprintf("PTY request failed: %v", err), cfg.Host)
		}
		return nil, err
	}

	stdin, err := session.StdinPipe()
	if err != nil {
		session.Close()
		client.Close()
		return nil, err
	}

	stdout, err := session.StdoutPipe()
	if err != nil {
		session.Close()
		client.Close()
		return nil, err
	}

	stderr, err := session.StderrPipe()
	if err != nil {
		session.Close()
		client.Close()
		return nil, err
	}

	if err := session.Shell(); err != nil {
		session.Close()
		client.Close()
		return nil, err
	}

	s := &Session{
		client:  client,
		session: session,
		stdin:   stdin,
	}

	if onStatus != nil {
		onStatus("CONNECTED", "", cfg.Host)
	}

	// Stream stdout & stderr
	readOutput := func(r io.Reader) {
		buf := make([]byte, 4096)
		for {
			n, err := r.Read(buf)
			if n > 0 && onData != nil {
				onData(string(buf[:n]))
			}
			if err != nil {
				break
			}
		}
	}

	go readOutput(stdout)
	go readOutput(stderr)

	go func() {
		_ = session.Wait()
		s.Close()
		if onStatus != nil {
			onStatus("DISCONNECTED", "SSH session ended", cfg.Host)
		}
	}()

	return s, nil
}

func (s *Session) Write(data string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || s.stdin == nil {
		return fmt.Errorf("session closed")
	}
	_, err := s.stdin.Write([]byte(data))
	return err
}

func (s *Session) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return
	}
	s.closed = true
	if s.stdin != nil {
		_ = s.stdin.Close()
	}
	if s.session != nil {
		_ = s.session.Close()
	}
	if s.client != nil {
		_ = s.client.Close()
	}
}
