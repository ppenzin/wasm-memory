cmake_minimum_required(VERSION 3.0.2) ## TODO lowest supported version

# Disallow in-tree build
set(CMAKE_DISABLE_SOURCE_CHANGES ON)
set(CMAKE_DISABLE_IN_SOURCE_BUILD ON)

project(wasm-memory C)

## TODO check --target=wasm32

set(JS_SHELL "" CACHE STRING "JavaScript engine for use with tests")

string(COMPARE EQUAL "${JS_SHELL}" "" DISABLE_TESTS)

set(CMAKE_C_FLAGS "--target=wasm32 -fvisibility=hidden ${CMAKE_C_FLAGS}")
if (NOT DISABLE_TESTS)
  set(CMAKE_EXE_LINKER_FLAGS "-Wl,--import-memory,--no-entry,--strip-all,--export-dynamic,--export=__heap_base -nostdlib ${CMAKE_EXE_LINKER_FLAGS}")
endif (NOT DISABLE_TESTS)

set(WASM_MEM_MAIN_BUILD_DIR ${CMAKE_CURRENT_BINARY_DIR}/src)

add_subdirectory(src)

if (NOT DISABLE_TESTS)
  add_subdirectory(test)
endif (NOT DISABLE_TESTS)

