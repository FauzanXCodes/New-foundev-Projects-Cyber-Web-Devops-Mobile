#ifndef TEST_NVS_SERVICE
#define TEST_NVS_SERVICE

#include <unity.h>
#include "../src/Services/NvsService.h"

void test_save_and_get_string() {
    NvsService nvsService;
    std::string key = "unitTestKey";
    std::string value = "Hello NVS";

    nvsService.saveString(key, value);
    std::string retrievedValue = nvsService.getString(key, "default");

    TEST_ASSERT_EQUAL_STRING(value.c_str(), retrievedValue.c_str());
}

void test_save_and_get_int() {
    NvsService nvsService;
    std::string key = "unitTestInt";
    int value = 42;

    nvsService.saveInt(key, value);
    int retrievedValue = nvsService.getInt(key, 0);

    TEST_ASSERT_EQUAL(value, retrievedValue);
}

void test_remove_key() {
    NvsService nvsService;
    std::string key = "testToBeRemoved";
    std::string value = "TempData";

    nvsService.saveString(key, value);
    nvsService.remove(key);

    std::string retrievedValue = nvsService.getString(key, "default");
    TEST_ASSERT_EQUAL_STRING("default", retrievedValue.c_str());
}

#endif // TEST_NVS_SERVICE
