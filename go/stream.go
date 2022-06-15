package main

import (
	"io"
	"syscall/js"
)

type StreamReader struct {
	reader   js.Value
	callback js.Func
	array    *js.Value
	filled   chan bool
}

func NewStreamReader(stream js.Value) *StreamReader {
	fr := &StreamReader{
		reader: stream.Call("getReader"),
		filled: make(chan bool),
	}
	fr.callback = js.FuncOf(fr.read)
	return fr
}

func (r *StreamReader) Read(buf []byte) (n int, err error) {
	for n < len(buf) {
		if r.array == nil {
			r.more()
			if !<-r.filled {
				err = io.EOF
				break
			}
		}
		i := js.CopyBytesToGo(buf[n:], *r.array)
		l := (*r.array).Length()
		if i == l {
			r.array = nil
		} else {
			adj := (*r.array).Call("subarray", i, l)
			r.array = &adj
		}
		n += i
	}
	return
}

func (r *StreamReader) more() {
	r.reader.Call("read").Call("then", r.callback)
}

func (r *StreamReader) read(this js.Value, args []js.Value) interface{} {
	if args[0].Get("done").Truthy() {
		r.filled <- false
	} else {
		value := args[0].Get("value")
		r.array = &value
		r.filled <- true
	}
	return nil
}
