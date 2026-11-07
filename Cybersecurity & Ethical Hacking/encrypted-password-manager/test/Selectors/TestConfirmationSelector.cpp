#ifndef TEST_CONFIRMATION_SELECTOR_H
#define TEST_CONFIRMATION_SELECTOR_H

#include <unity.h>
#include "../src/Selectors/ConfirmationSelector.h"
#include "../Views/MockView.h"
#include "../Inputs/MockInput.h"

void test_confirmation_selector_confirm() {
    MockView mockView;
    MockInput mockInput;

    ConfirmationSelector confirmationSelector(mockView, mockInput);

    std::string description = "Are you sure?";
    mockInput.enqueueKey(KEY_OK);

    bool result = confirmationSelector.select("Title", description);

    TEST_ASSERT_TRUE(result);
    TEST_ASSERT_TRUE(mockView.topBarCalled);
    TEST_ASSERT_TRUE(mockView.confirmationPromptCalled);
    TEST_ASSERT_EQUAL_STRING("Title", mockView.lastTitle.c_str());
}

void test_confirmation_selector_cancel() {
    MockView mockView;
    MockInput mockInput;

    ConfirmationSelector confirmationSelector(mockView, mockInput);

    std::string description = "Are you sure?";
    mockInput.enqueueKey(KEY_ESC_CUSTOM);

    bool result = confirmationSelector.select("Test", description);

    TEST_ASSERT_FALSE(result);
    TEST_ASSERT_TRUE(mockView.topBarCalled);
    TEST_ASSERT_EQUAL_STRING("Test", mockView.lastTitle.c_str());
}

#endif // TEST_CONFIRMATION_SELECTOR_H
