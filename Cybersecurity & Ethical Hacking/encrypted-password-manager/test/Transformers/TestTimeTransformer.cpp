#ifndef TEST_TIME_TRANSFORMER
#define TEST_TIME_TRANSFORMER

#include <unity.h>
#include "../src/Transformers/TimeTransformer.h"

void test_to_label() {
    TimeTransformer transformer;

    TEST_ASSERT_EQUAL_STRING("1 minute", transformer.toLabel(60000).c_str());
    TEST_ASSERT_EQUAL_STRING("30 minutes", transformer.toLabel(1800000).c_str());
    TEST_ASSERT_EQUAL_STRING("1 hour", transformer.toLabel(3600000).c_str());
    
    // Unknow value
    TEST_ASSERT_EQUAL_STRING("Unknown", transformer.toLabel(9999999).c_str());
}

void test_to_milliseconds() {
    TimeTransformer transformer;

    TEST_ASSERT_EQUAL(60000, transformer.toMilliseconds("1 minute"));
    TEST_ASSERT_EQUAL(180000, transformer.toMilliseconds("3 minutes"));
    TEST_ASSERT_EQUAL(1800000, transformer.toMilliseconds("30 minutes"));
    TEST_ASSERT_EQUAL(3600000, transformer.toMilliseconds("1 hour"));

    // Test d'une valeur inconnue
    TEST_ASSERT_EQUAL(0, transformer.toMilliseconds("Unknown time"));
}

void test_get_all_time_labels() {
    TimeTransformer transformer;
    auto labels = transformer.getAllTimeLabels();

    TEST_ASSERT_EQUAL_STRING("1 minute", labels[1].c_str());
    TEST_ASSERT_EQUAL_STRING("10 minutes", labels[4].c_str());
    TEST_ASSERT_EQUAL_STRING("30 minutes", labels[5].c_str());
}

void test_get_all_time_values() {
    TimeTransformer transformer;
    auto values = transformer.getAllTimeValues();

    TEST_ASSERT_EQUAL(60000, values[1]);
    TEST_ASSERT_EQUAL(180000, values[2]);
    TEST_ASSERT_EQUAL(1800000, values[5]);
    TEST_ASSERT_EQUAL(3600000, values[6]);
}

#endif // TEST_TIME_TRANSFORMER
