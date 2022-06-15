package main

import (
	"archive/tar"
	"fmt"
	"syscall/js"
)

func main() {
	js.Global().Get("hooks").Set("TarFile", js.FuncOf(TarFile))
	fmt.Println("Initialized Go Environment")

	ch := make(chan interface{})
	<-ch
}

func TarFile(this js.Value, args []js.Value) any {
	f := NewStreamReader(args[0])
	t := tar.NewReader(f)

	obj := js.Global().Get("Object").New()
	promise := js.Global().Get("Promise")
	obj.Set("Next", js.FuncOf(func(this js.Value, args []js.Value) any {
		var resolve js.Value
		p := promise.New(js.FuncOf(func(this js.Value, args []js.Value) any {
			resolve = args[0]
			return nil
		}))
		go func() {
			hdr, err := t.Next()
			if err != nil {
				resolve.Invoke(err.Error())
				return
			}
			fmt.Printf("[TODO] Next: %#v\n", hdr)
			resolve.Invoke(nil)
		}()
		return p
	}))
	obj.Set("Read", js.FuncOf(func(this js.Value, args []js.Value) any {
		fmt.Printf("[TODO] Read\n")
		return nil
	}))
	return obj
}
