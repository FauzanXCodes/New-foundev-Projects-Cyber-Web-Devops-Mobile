#ifndef TEST_ACTION_ENUM_MAPPER_H
#define TEST_ACTION_ENUM_MAPPER_H

#include <unity.h>
#include "../src/Enums/ActionEnum.h"

void test_action_enum_to_string() {
    TEST_ASSERT_EQUAL_STRING("Open Vault", ActionEnumMapper::toString(ActionEnum::OpenVault).c_str());
    TEST_ASSERT_EQUAL_STRING("Close Vault", ActionEnumMapper::toString(ActionEnum::CloseVault).c_str());
    TEST_ASSERT_EQUAL_STRING("Unknown Action", ActionEnumMapper::toString(static_cast<ActionEnum>(999)).c_str());
}

void test_action_enum_get_action_names() {
    std::vector<ActionEnum> actions = {
        ActionEnum::OpenVault,
        ActionEnum::CreateVault,
        ActionEnum::ShowHelp
    };
    std::vector<std::string> expected = {
        "Open Vault",
        "Create Vault",
        "Show Help"
    };

    std::vector<std::string> result = ActionEnumMapper::getActionNames(actions);

    TEST_ASSERT_EQUAL(expected.size(), result.size());
    for (size_t i = 0; i < expected.size(); ++i) {
        TEST_ASSERT_EQUAL_STRING(expected[i].c_str(), result[i].c_str());
    }
}

#endif // TEST_ACTION_ENUM_MAPPER_H
