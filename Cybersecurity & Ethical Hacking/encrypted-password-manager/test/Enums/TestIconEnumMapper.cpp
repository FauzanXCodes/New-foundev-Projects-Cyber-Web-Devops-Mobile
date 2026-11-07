#ifndef TEST_ICON_ENUM_MAPPER_H
#define TEST_ICON_ENUM_MAPPER_H

#include <unity.h>
#include "../src/Enums/IconEnum.h"

void test_icon_enum_to_string() {
    TEST_ASSERT_EQUAL_STRING("Create Vault", IconEnumMapper::toString(IconEnum::CreateVault).c_str());
    TEST_ASSERT_EQUAL_STRING("Load Vault", IconEnumMapper::toString(IconEnum::LoadVault).c_str());
    TEST_ASSERT_EQUAL_STRING("Settings", IconEnumMapper::toString(IconEnum::Settings).c_str());
    TEST_ASSERT_EQUAL_STRING("Unknown Icon", IconEnumMapper::toString(static_cast<IconEnum>(999)).c_str());
}

void test_icon_enum_get_icon_names() {
    std::vector<IconEnum> icons = {
        IconEnum::CreateVault,
        IconEnum::LoadVault,
        IconEnum::Settings
    };
    std::vector<std::string> expected = {
        "Create Vault",
        "Load Vault",
        "Settings"
    };

    std::vector<std::string> result = IconEnumMapper::getIconNames(icons);

    TEST_ASSERT_EQUAL(expected.size(), result.size());
    for (size_t i = 0; i < expected.size(); ++i) {
        TEST_ASSERT_EQUAL_STRING(expected[i].c_str(), result[i].c_str());
    }
}

#endif // TEST_ICON_ENUM_MAPPER_H
