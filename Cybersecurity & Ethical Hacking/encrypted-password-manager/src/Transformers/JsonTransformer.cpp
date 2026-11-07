#include "JsonTransformer.h"
#include <ArduinoJson.h>
#include <stdexcept>

std::string JsonTransformer::emptyJsonStructure() {
    JsonDocument doc;

    JsonObject root = doc.to<JsonObject>();
    root.createNestedArray("entries");
    root.createNestedArray("categories");

    std::string jsonContent;
    serializeJson(doc, jsonContent);

    return jsonContent;
}

std::string JsonTransformer::toJson(const std::vector<Entry>& entries) {
    JsonDocument doc;

    JsonArray entriesArray = doc.to<JsonArray>();
    for (const auto& entry : entries) {
        JsonObject entryObj = entriesArray.createNestedObject();
        entryObj["id"] = entry.getId();
        entryObj["serviceName"] = entry.getServiceName();
        entryObj["username"] = entry.getUsername();
        entryObj["password"] = entry.getPassword();
        entryObj["categoryIndex"] = entry.getCategoryIndex();
        entryObj["notes"] = entry.getNotes();
        entryObj["createdAt"] = static_cast<long>(entry.getCreatedAt());
        entryObj["updatedAt"] = static_cast<long>(entry.getUpdatedAt());
        entryObj["expiresAt"] = static_cast<long>(entry.getExpiresAt());
    }

    std::string jsonContent;
    serializeJson(doc, jsonContent);
    return jsonContent;
}

std::vector<Entry> JsonTransformer::fromJsonToEntries(const std::string& jsonContent) {
    JsonDocument doc;

    DeserializationError error = deserializeJson(doc, jsonContent);
    if (error) {
        throw std::runtime_error("Failed to parse JSON: " + std::string(error.c_str()));
    }

    std::vector<Entry> entries;

    JsonArray entriesArray = doc["entries"].as<JsonArray>();
    for (JsonObject entryObj : entriesArray) {
        Entry entry;
        entry.setId(entryObj["id"].as<std::string>());
        entry.setServiceName(entryObj["serviceName"].as<std::string>());
        entry.setUsername(entryObj["username"].as<std::string>());
        entry.setPassword(entryObj["password"].as<std::string>());
        entry.setCategoryIndex(entryObj["categoryIndex"].as<size_t>());
        entry.setNotes(entryObj["notes"].as<std::string>());
        entry.setNotes2(entryObj["notes2"].as<std::string>());
        entry.setNotes3(entryObj["notes3"].as<std::string>());
        entry.setLink(entryObj["link"].as<std::string>());
        entry.setCreatedAt(entryObj["createdAt"].as<long>());
        entry.setUpdatedAt(entryObj["updatedAt"].as<long>());
        entry.setExpiresAt(entryObj["expiresAt"].as<long>());

        entries.push_back(entry);
    }

    return entries;
}

std::string JsonTransformer::toJson(const std::vector<Category>& categories) {
    JsonDocument doc;

    JsonArray categoriesArray = doc.to<JsonArray>();
    for (const auto& category : categories) {
        JsonObject categoryObj = categoriesArray.createNestedObject();
        categoryObj["index"] = category.getIndex();
        categoryObj["name"] = category.getName();
        categoryObj["colorCode"] = category.getColorCode();
        categoryObj["iconPath"] = category.getIconPath();
    }

    std::string jsonContent;
    serializeJson(doc, jsonContent);
    return jsonContent;
}

std::vector<Category> JsonTransformer::fromJsonToCategories(const std::string& jsonContent) {
    JsonDocument doc;

    DeserializationError error = deserializeJson(doc, jsonContent);
    if (error) {
        throw std::runtime_error("Failed to parse JSON: " + std::string(error.c_str()));
    }

    std::vector<Category> categories;

    JsonArray categoriesArray = doc["categories"].as<JsonArray>();
    for (JsonObject categoryObj : categoriesArray) {
        Category category;
        category.setIndex(categoryObj["index"].as<size_t>());
        category.setName(categoryObj["name"].as<std::string>());
        category.setColorCode(categoryObj["colorCode"].as<std::string>());
        category.setIconPath(categoryObj["iconPath"].as<std::string>());

        categories.push_back(category);
    }

    return categories;
}

std::string JsonTransformer::mergeEntriesAndCategoriesToJson(const std::vector<Entry>& entries, const std::vector<Category>& categories) {
    JsonDocument doc;
    JsonObject root = doc.to<JsonObject>();

    JsonArray categoriesArray = root.createNestedArray("categories");
    for (const auto& category : categories) {
        JsonObject categoryObj = categoriesArray.createNestedObject();
        categoryObj["index"] = category.getIndex();
        categoryObj["name"] = category.getName();
        categoryObj["colorCode"] = category.getColorCode();
        categoryObj["iconPath"] = category.getIconPath();
    }

    JsonArray entriesArray = root.createNestedArray("entries");
    for (const auto& entry : entries) {
        JsonObject entryObj = entriesArray.createNestedObject();
        entryObj["id"] = entry.getId();
        entryObj["serviceName"] = entry.getServiceName();
        entryObj["username"] = entry.getUsername();
        entryObj["password"] = entry.getPassword();
        entryObj["categoryIndex"] = entry.getCategoryIndex();
        entryObj["notes"] = entry.getNotes();
        entryObj["notes2"] = entry.getNotes2();
        entryObj["notes3"] = entry.getNotes3();
        entryObj["link"] = entry.getLink();
        entryObj["createdAt"] = static_cast<long>(entry.getCreatedAt());
        entryObj["updatedAt"] = static_cast<long>(entry.getUpdatedAt());
        entryObj["expiresAt"] = static_cast<long>(entry.getExpiresAt());
    }

    std::string jsonContent;
    serializeJson(doc, jsonContent);

    return jsonContent;
}