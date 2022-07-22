package main

import (
	"syscall/js"
)

func main() {
	js.Global().Get("hooks").Set("TarFile", js.FuncOf(TarFile))
	js.Global().Get("hooks").Set("ParseEmail", js.FuncOf(ParseEmail))

	ch := make(chan interface{})
	<-ch
}
