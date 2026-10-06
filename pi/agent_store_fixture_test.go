package browser

import (
	"crypto/rand"
	"os"
	"testing"
)

func testStore(t *testing.T) *SealedStore {
	t.Helper()
	key := make([]byte, 32)
	rand.Read(key)
	dir := t.TempDir()
	os.Chmod(dir, 0700)
	s, e := NewSealedStore(dir, key)
	if e != nil {
		t.Fatal(e)
	}
	return s
}
