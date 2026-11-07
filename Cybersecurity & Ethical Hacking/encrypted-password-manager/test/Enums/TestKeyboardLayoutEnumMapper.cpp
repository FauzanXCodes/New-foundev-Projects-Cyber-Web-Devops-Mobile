#ifndef TEST_KEYBOARD_LAYOUT_ENUM_H
#define TEST_KEYBOARD_LAYOUT_ENUM_H

#include <unity.h>
#include "../src/Enums/KeyboardLayoutEnum.h"

void test_to_layout_valid_name() {
    TEST_ASSERT_EQUAL_PTR(KeyboardLayout_fr_FR, KeyboardLayoutMapper::toLayout("French (FR)"));
}

void test_to_layout_invalid_name() {
    TEST_ASSERT_EQUAL_PTR(KeyboardLayout_en_US, KeyboardLayoutMapper::toLayout("Invalid Layout"));
    TEST_ASSERT_EQUAL_PTR(KeyboardLayout_en_US, KeyboardLayoutMapper::toLayout(""));
}

void test_get_all_layout_names() {
    std::vector<std::string> layouts = KeyboardLayoutMapper::getAllLayoutNames();
    TEST_ASSERT_FALSE(layouts.empty());
    std::string us = "English (US)";
    TEST_ASSERT_EQUAL_STRING(layouts[2].c_str(), us.c_str());
}

#endif // TEST_KEYBOARD_LAYOUT_ENUM_H
