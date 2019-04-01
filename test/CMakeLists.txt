if (NOT DISABLE_TESTS)
  enable_testing() # Enable CTest

  # `check` target
  add_custom_target(check COMMAND ${CMAKE_CTEST_COMMAND} DEPENDS mem.wasm)

  file(GLOB test_list RELATIVE ${CMAKE_CURRENT_SOURCE_DIR} "*.js")
  foreach(test ${test_list})
    add_test(NAME ${test} COMMAND ${JS_SHELL} ${CMAKE_CURRENT_SOURCE_DIR}/${test} WORKING_DIRECTORY ${WASM_MEM_MAIN_BUILD_DIR})
    set_tests_properties(${test} PROPERTIES PASS_REGULAR_EXPRESSION "PASS")
  endforeach()
endif (NOT DISABLE_TESTS)

