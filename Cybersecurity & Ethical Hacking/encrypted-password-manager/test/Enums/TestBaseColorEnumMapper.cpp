#ifndef TEST_BASE_COLOR_ENUM_MAPPER_H
#define TEST_BASE_COLOR_ENUM_MAPPER_H

#include <unity.h>
#include "../src/Enums/BaseColorEnum.h"

void test_base_color_enum_to_string() {
    TEST_ASSERT_EQUAL_STRING("Black", BaseColorEnumMapper::toString(BaseColorEnum::Black).c_str());
    TEST_ASSERT_EQUAL_STRING("Sky Blue", BaseColorEnumMapper::toString(BaseColorEnum::SkyBlue).c_str());
    TEST_ASSERT_EQUAL_STRING("Unknown Color", BaseColorEnumMapper::toString(static_cast<BaseColorEnum>(999)).c_str());
}

void test_base_color_enum_to_color_value() {
    TEST_ASSERT_EQUAL(TFT_BLACK, BaseColorEnumMapper::toColorValue(BaseColorEnum::Black));
    TEST_ASSERT_EQUAL(TFT_SKYBLUE, BaseColorEnumMapper::toColorValue(BaseColorEnum::SkyBlue));
    TEST_ASSERT_EQUAL(TFT_BLACK, BaseColorEnumMapper::toColorValue(static_cast<BaseColorEnum>(999))); // Valeur inconnue
}

void test_base_color_enum_get_all_color_names() {
    std::vector<std::string> result = BaseColorEnumMapper::getAllColorNames();

    TEST_ASSERT_TRUE(std::find(result.begin(), result.end(), "Black") != result.end());
    TEST_ASSERT_TRUE(std::find(result.begin(), result.end(), "Sky Blue") != result.end());
    TEST_ASSERT_TRUE(std::find(result.begin(), result.end(), "Transparent") != result.end());

    TEST_ASSERT_EQUAL(27, result.size());
}

#endif // TEST_BASE_COLOR_ENUM_MAPPER_H
