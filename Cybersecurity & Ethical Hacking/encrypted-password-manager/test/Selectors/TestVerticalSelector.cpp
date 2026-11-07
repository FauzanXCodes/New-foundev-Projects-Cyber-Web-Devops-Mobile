
#ifndef TEST_VERTICAL_SELECTORS_H
#define TEST_VERTICAL_SELECTORS_H

#include <unity.h>
#include "../src/Selectors/VerticalSelector.h"
#include "../src/Selectors/HorizontalSelector.h"
#include "../src/Managers/InactivityManager.h"
#include "../Views/MockView.h"
#include "../Inputs/MockInput.h"


void test_vertical_selector_confirm() {
    MockView mockView;
    MockInput mockInput;
    InactivityManager manager(mockView);
    VerticalSelector verticalSelector(mockView, mockInput, manager);

    std::vector<std::string> options = {"Option1", "Option2", "Option3"};
    std::string title = "Vertical Selector Test";

    // Mock Input
    mockInput.enqueueKey(KEY_ARROW_DOWN);
    mockInput.enqueueKey(KEY_ARROW_DOWN);
    mockInput.enqueueKey(KEY_ARROW_UP);
    mockInput.enqueueKey(KEY_OK);

    int selectedIndex = verticalSelector.select(title, options);

    TEST_ASSERT_EQUAL(1, selectedIndex); // Option 2 (index 1) selected
    TEST_ASSERT_TRUE(mockView.topBarCalled);
    TEST_ASSERT_TRUE(mockView.verticalSelectionCalled);
    TEST_ASSERT_EQUAL_STRING(title.c_str(), mockView.lastTitle.c_str());
    TEST_ASSERT_EQUAL_STRING("Option2", mockView.displayedOptions[selectedIndex].c_str());
}

void test_vertical_selector_cancel() {
    MockView mockView;
    MockInput mockInput;
    InactivityManager manager(mockView);
    VerticalSelector verticalSelector(mockView, mockInput, manager);

    std::vector<std::string> options = {"Option1", "Option2", "Option3"};
    std::string title = "Vertical Selector Test";

    // Mock input
    mockInput.enqueueKey(KEY_ARROW_LEFT);

    int selectedIndex = verticalSelector.select(title, options);

    TEST_ASSERT_EQUAL(-1, selectedIndex); // Option 3 is selected
}

void test_vertical_selector_shortcut() {
    MockView mockView;
    MockInput mockInput;
    InactivityManager manager(mockView);
    VerticalSelector verticalSelector(mockView, mockInput, manager);

    std::vector<std::string> options = {"Open Vault", "Create Vault", "Settings"};
    std::vector<std::string> shortcuts = {"O", "C", "S"};
    std::string title = "Vertical Selector Test";

    // Mock input for create vault
    mockInput.enqueueKey('C');

    int selectedIndex = verticalSelector.select(title, options, false, false, {}, shortcuts, false, false);

    TEST_ASSERT_EQUAL(1, selectedIndex); // "Create Vault" index 1
}

#endif // TEST_VERTICAL_SELECTORS_H
