package prober

import (
	"errors"
	"testing"
)

func TestProberEngine_ClassifyNetworkError(t *testing.T) {
	engine := &ProberEngine{}

	tests := []struct {
		err      error
		expected string
	}{
		{errors.New("dial tcp: lookup nonexistingdomain.test: no such host"), "DNS_RESOLUTION_FAILED"},
		{errors.New("dial tcp 127.0.0.1:9999: connect: connection refused"), "CONNECTION_REFUSED"},
		{errors.New("context deadline exceeded (Client.Timeout exceeded while awaiting headers)"), "CONNECTION_TIMEOUT"},
		{errors.New("x509: certificate has expired or is not yet valid"), "SSL_CERTIFICATE_ERROR"},
	}

	for _, tc := range tests {
		actual := engine.classifyNetworkError(tc.err)
		if actual != tc.expected {
			t.Errorf("For error %q, expected %q, got %q", tc.err, tc.expected, actual)
		}
	}
}
