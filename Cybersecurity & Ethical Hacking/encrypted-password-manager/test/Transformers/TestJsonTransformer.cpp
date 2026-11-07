#ifndef TEST_JSON_TRANSFORMER
#define TEST_JSON_TRANSFORMER
#include <unity.h>
#include "../src/Transformers/JsonTransformer.h"
#include <vector>
#include "../src/States/GlobalState.h"

void test_to_json_categories() {
    JsonTransformer transformer;

    std::vector<Category> categories = {
        Category(1, "Personal", "#FF5733", "icon1.png"),
        Category(2, "Work", "#33FF57", "icon2.png"),
    };

    std::string json = transformer.toJson(categories);

    TEST_ASSERT_NOT_EQUAL(0, json.size());
    TEST_ASSERT_TRUE(json.find("Personal") != std::string::npos);
    TEST_ASSERT_TRUE(json.find("Work") != std::string::npos);
}

void test_from_json_to_entries() {
    JsonTransformer transformer;
    std::string jsonContent = R"({
        "categories": [],
        "entries": [{
            "id": "1",
            "serviceName": "Service1",
            "username": "User1",
            "password": "Pass1",
            "categoryIndex": 0,
            "notes": "Note1",
            "notes2": "Note2",
            "notes3": "Note3",
            "link": "http://example.com",
            "createdAt": 1672531200,
            "updatedAt": 1672531300,
            "expiresAt": 1672531400
        }]
    })";

    std::vector<Entry> entries = transformer.fromJsonToEntries(jsonContent);

    TEST_ASSERT_EQUAL(1, entries.size());
    TEST_ASSERT_EQUAL_STRING("Service1", entries[0].getServiceName().c_str());
    TEST_ASSERT_EQUAL(1672531200, entries[0].getCreatedAt());
}

void test_from_json_to_categories() {
    JsonTransformer transformer;
    std::string jsonContent = R"({
        "categories": [{
            "index": 0,
            "name": "Social Media",
            "colorCode": "#FF5733",
            "iconPath": "icons/social.png"
        }, {
            "index": 1,
            "name": "Finance",
            "colorCode": "#33FF57",
            "iconPath": "icons/finance.png"
        }],
        "entries": []
    })";

    std::vector<Category> categories = transformer.fromJsonToCategories(jsonContent);

    TEST_ASSERT_EQUAL(2, categories.size());
    TEST_ASSERT_EQUAL_STRING("Social Media", categories[0].getName().c_str());
    TEST_ASSERT_EQUAL_STRING("#FF5733", categories[0].getColorCode().c_str());
}

void test_merge_entries_and_categories_to_json() {
    JsonTransformer transformer;

    std::vector<Entry> entries = {
        Entry("1", "Facebook", "user1", "encryptedPass1", 0),
        Entry("2", "Google", "user2", "encryptedPass2", 1)
    };
    std::vector<Category> categories = {
        Category(0, "Social Media", "#FF5733", "icons/social.png"),
        Category(1, "Finance", "#33FF57", "icons/finance.png")
    };

    std::string json = transformer.mergeEntriesAndCategoriesToJson(entries, categories);

    TEST_ASSERT_NOT_EQUAL(0, json.size());
    TEST_ASSERT_TRUE(json.find("Facebook") != std::string::npos);
    TEST_ASSERT_TRUE(json.find("Google") != std::string::npos);
    TEST_ASSERT_TRUE(json.find("Social Media") != std::string::npos);
    TEST_ASSERT_TRUE(json.find("Finance") != std::string::npos);
}

#endif // TEST_JSON_TRANSFORMER
