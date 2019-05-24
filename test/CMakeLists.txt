enable_testing() # Enable CTest

# `check` target
add_custom_target(check COMMAND ${CMAKE_CTEST_COMMAND} DEPENDS mem.wasm)

# This would add every JavaScript file as a test, but it requires rerunning
# CMake to detect new or missing files
file(GLOB_RECURSE test_list RELATIVE ${CMAKE_CURRENT_SOURCE_DIR} "*.js")
foreach(test ${test_list})
  add_test(NAME ${test} COMMAND ${JS_SHELL} ${CMAKE_CURRENT_SOURCE_DIR}/${test} WORKING_DIRECTORY ${WASM_MEM_MAIN_BUILD_DIR})
  set_tests_properties(${test} PROPERTIES PASS_REGULAR_EXPRESSION "PASS")
endforeach()

