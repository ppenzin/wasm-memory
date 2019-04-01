wasm-memory
===========

`libc` memory related routines for WebAssembly.

Goal is to provide a quick interface to memory manipulation routines when targetting WebAssembly.

## Building

Prerequisites:

- Clang 8 or never (with wasm support)
- Only for tests: JavaScript shell (with wasm support)

To build, create a build directory (in-source builds unsupported)

```
$ cd build-dir
$ cmake -DCMAKE_C_COMPILER=clang <path to this directory>
$ make
```

To run tests, use `JS_SHELL` CMake variable and `check` target:

```
$ cmake -DCMAKE_C_COMPILER=clang -DJS_SHELL=<js_shell> <path to this directory>
$ make check
```

