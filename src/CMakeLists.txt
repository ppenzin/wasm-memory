set(SRC memory.c)

add_library(wasm-mem STATIC ${SRC})

if (NOT DISABLE_TESTS)
  add_executable(mem.wasm ${SRC})
endif (NOT DISABLE_TESTS)

