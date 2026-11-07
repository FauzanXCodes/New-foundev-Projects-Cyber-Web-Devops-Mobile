#ifndef TEST_STRING_SELECTOR_H
#define TEST_STRING_SELECTOR_H

#include <unity.h>
#include "../src/Selectors/StringPromptSelector.h"
#include "../Views/MockView.h"
#include "../Inputs/MockInput.h"

void test_string_selector_confirm() {
    MockView mockView;
    MockInput mockInput;

    StringPromptSelector stringPrompt(mockView, mockInput);

    std::string description = "Enter your name:";
    mockInput.enqueueKey('J');
    mockInput.enqueueKey('o');
    mockInput.enqueueKey('h');
    mockInput.enqueueKey('n');
    mockInput.enqueueKey(KEY_OK);

    std::string result = stringPrompt.select("Test", description);

    TEST_ASSERT_EQUAL_STRING("John", result.c_str());
    TEST_ASSERT_TRUE(mockView.topBarCalled);
    TEST_ASSERT_TRUE(mockView.stringPromptCalled);
    TEST_ASSERT_EQUAL_STRING("Test", mockView.lastTitle.c_str());
}

void test_string_selector_cancel() {
    MockView mockView;
    MockInput mockInput;

    StringPromptSelector stringPrompt(mockView, mockInput);

    std::string description = "Enter your name:";
    mockInput.enqueueKey(KEY_ESC_CUSTOM);

    std::string result = stringPrompt.select("Title", description);

    TEST_ASSERT_EQUAL_STRING("", result.c_str());
    TEST_ASSERT_TRUE(mockView.topBarCalled);
    TEST_ASSERT_TRUE(mockView.stringPromptCalled);
    TEST_ASSERT_EQUAL_STRING("Title", mockView.lastTitle.c_str());
}

#endif // TEST_STRING_SELECTOR_H
