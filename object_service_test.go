package browser

import (
	"encoding/json"
	"testing"
)

func TestObjectBootstrapRejectsAmbiguousOrPrivateAgentConfiguration(t *testing.T) {
	c := ObjectBootstrap{Browser: testBootstrap(t, "alice"), Storage: syntheticS3Config()}
	data, _ := json.Marshal(c)
	if _, err := ParseObjectBootstrap(data); err != nil {
		t.Fatal("valid bootstrap", err)
	}
	for _, mutate := range []func(*ObjectBootstrap){
		func(c *ObjectBootstrap) { c.Browser.InferenceKey = "synthetic-inference-key" },
		func(c *ObjectBootstrap) { c.Browser.Owner = "../bob" },
		func(c *ObjectBootstrap) { c.Browser.StorageKey = "" },
		func(c *ObjectBootstrap) { c.Storage.Bucket = "" },
		func(c *ObjectBootstrap) { c.Storage.Region = "http://attacker.invalid" },
		func(c *ObjectBootstrap) { c.Storage.AccessKeyID = "" },
		func(c *ObjectBootstrap) { c.Storage.Expires = 0 },
		func(c *ObjectBootstrap) { c.Storage.SessionToken = "" },
	} {
		bad := c
		mutate(&bad)
		data, _ = json.Marshal(bad)
		if _, err := ParseObjectBootstrap(data); err == nil {
			t.Fatal("unsafe object bootstrap accepted")
		}
	}
	data, _ = json.Marshal(c)
	for _, bad := range [][]byte{append(append([]byte{}, data...), data...), append(data[:len(data)-1], []byte(`,"endpoint":"http://attacker.invalid"}`)...), make([]byte, (64<<10)+1)} {
		if _, err := ParseObjectBootstrap(bad); err == nil {
			t.Fatal("ambiguous object bootstrap accepted")
		}
	}
}
