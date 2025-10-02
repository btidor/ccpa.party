package main

import (
	"syscall/js"
)

func main() {
	js.Global().Set("TarFile", js.FuncOf(TarFile))
	js.Global().Set("ParseEmail", js.FuncOf(ParseEmail))

	ch := make(chan interface{})
	<-ch
}
