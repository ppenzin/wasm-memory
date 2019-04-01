cmake_minimum_required(VERSION 3.0.2) ## TODO lowest supported version

# Disallow in-tree build
set(CMAKE_DISABLE_SOURCE_CHANGES ON)
set(CMAKE_DISABLE_IN_SOURCE_BUILD ON)

project(wasm-memory C)

## TODO check --target=wasm32

set(JS_SHELL CACHE "JavaScript engine for use with tests" "")

string(COMPARE EQUAL "${JS_ENGINE_FOR_TEST}" "" DISABLE_TESTS)

set(CMAKE_C_FLAGS "--target=wasm32 -fvisibility=hidden ${CMAKE_C_FLAGS}")
set(CMAKE_EXE_LINKER_FLAGS "-Wl,--import-memory,--no-entry,--strip-all,--export-dynamic -nostdlib ${CMAKE_EXE_LINKER_FLAGS}")

set(WASM_MEM_MAIN_BUILD_DIR ${CMAKE_CURRENT_BINARY_DIR}/src)
message(${WASM_MEM_MAIN_BUILD_DIR})

add_subdirectory(src)
add_subdirectory(test)

