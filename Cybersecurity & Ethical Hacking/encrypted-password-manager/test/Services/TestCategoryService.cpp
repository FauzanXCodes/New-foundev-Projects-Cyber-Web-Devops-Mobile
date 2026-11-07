#ifndef TEST_CATEGORY_SERVICE
#define TEST_CATEGORY_SERVICE

#include <unity.h>
#include "../src/Services/CategoryService.h"
#include "../src/Repositories/CategoryRepository.h"

void test_validateCategory() {
    CategoryRepository repository;
    CategoryService service(repository);

    Category validCategory(1, "Work", "#FF0000", "work-icon.png");
    Category invalidCategory(2, "", "#00FF00", "home-icon.png");

    TEST_ASSERT_TRUE(service.validateCategory(validCategory));
    TEST_ASSERT_FALSE(service.validateCategory(invalidCategory));
}

void test_add_and_find_category() {
    CategoryRepository repository;
    CategoryService service(repository);

    Category category(1, "Work", "#FF0000", "work-icon.png");
    service.addCategory(category);

    Category foundCategory = service.findCategoryByIndex(1);

    TEST_ASSERT_EQUAL_STRING("Work", foundCategory.getName().c_str());
    TEST_ASSERT_EQUAL_STRING("#FF0000", foundCategory.getColorCode().c_str());
}

void test_update_category() {
    CategoryRepository repository;
    CategoryService service(repository);

    Category category(1, "Work", "#FF0000", "work-icon.png");
    service.addCategory(category);

    Category updatedCategory(1, "Home", "#00FF00", "home-icon.png");
    service.updateCategory(1, updatedCategory);

    Category foundCategory = service.findCategoryByIndex(1);
    TEST_ASSERT_EQUAL_STRING("Home", foundCategory.getName().c_str());
    TEST_ASSERT_EQUAL_STRING("#00FF00", foundCategory.getColorCode().c_str());
}

void test_sort_categories_by_name() {
    CategoryRepository repository;
    CategoryService service(repository);

    service.addCategory(Category(2, "Work", "#FF0000", "work-icon.png"));
    service.addCategory(Category(1, "Home", "#00FF00", "home-icon.png"));

    auto sortedCategories = service.sortCategoriesByName();

    TEST_ASSERT_EQUAL(2, sortedCategories.size());
    TEST_ASSERT_EQUAL_STRING("Home", sortedCategories[0].getName().c_str());
    TEST_ASSERT_EQUAL_STRING("Work", sortedCategories[1].getName().c_str());
}

void test_get_all_categories() {
    CategoryRepository repository;
    CategoryService service(repository);

    service.addCategory(Category(1, "Work", "#FF0000", "work-icon.png"));
    service.addCategory(Category(2, "Home", "#00FF00", "home-icon.png"));

    auto categories = service.getAllCategories();

    TEST_ASSERT_EQUAL(2, categories.size());
    TEST_ASSERT_EQUAL_STRING("Work", categories[0].getName().c_str());
    TEST_ASSERT_EQUAL_STRING("Home", categories[1].getName().c_str());
}

void test_delete_category() {
    CategoryRepository repository;
    CategoryService service(repository);

    service.addCategory(Category(1, "Work", "#FF0000", "work-icon.png"));
    bool result = repository.deleteCategoryByIndex(1);

    TEST_ASSERT_TRUE(result);

    Category foundCategory = service.findCategoryByIndex(1);
    TEST_ASSERT_TRUE(foundCategory.getName().empty());
}

#endif // TEST_CATEGORY_SERVICE
