#ifndef TEST_FIELD_EDITOR_SELECTOR_H
#define TEST_FIELD_EDITOR_SELECTOR_H

#include <unity.h>
#include "../src/Selectors/FieldEditorSelector.h"
#include "../Views/MockView.h"
#include "../Inputs/MockInput.h"

void test_field_editor_selector_confirm() {
    MockView mockView;
    MockInput mockInput;

    FieldEditorSelector fieldEditor(mockView, mockInput);

    std::vector<std::string> fieldNames = {"Name", "Age", "Email"};
    std::vector<std::string> fieldValues = {"John", "30", "john@example.com"};
    std::string title = "Edit Fields";

    // Mock input
    mockInput.enqueueKey(KEY_ARROW_DOWN);    // go to "Age"
    mockInput.enqueueKey(KEY_DEL);          // Erase 0 to "Age"
    mockInput.enqueueKey('3');             // add "3" to "Age"
    mockInput.enqueueKey(KEY_ARROW_DOWN); // Go to mail
    mockInput.enqueueKey('!');           // Add !
    mockInput.enqueueKey(KEY_ARROW_UP); // Go to "Age"
    mockInput.enqueueKey(KEY_DEL);     // Erase 3
    mockInput.enqueueKey('7');        // Add 7
    mockInput.enqueueKey(KEY_OK);    // Confirm

    auto modifiedFields = fieldEditor.select(fieldNames, fieldValues, title);

    // Vérifier les résultats
    TEST_ASSERT_EQUAL(3, modifiedFields.size());
    TEST_ASSERT_EQUAL_STRING("John", modifiedFields[0].c_str());
    TEST_ASSERT_EQUAL_STRING("37", modifiedFields[1].c_str());
    TEST_ASSERT_EQUAL_STRING("john@example.com!", modifiedFields[2].c_str());

    TEST_ASSERT_TRUE(mockView.topBarCalled);
    TEST_ASSERT_TRUE(mockView.verticalSelectionCalled);
    TEST_ASSERT_EQUAL_STRING(title.c_str(), mockView.lastTitle.c_str());
}

void test_field_editor_selector_cancel() {
    MockView mockView;
    MockInput mockInput;

    FieldEditorSelector fieldEditor(mockView, mockInput);

    std::vector<std::string> fieldNames = {"Name", "Age", "Email"};
    std::vector<std::string> fieldValues = {"John", "30", "john@example.com"};
    std::string title = "Edit Fields";

    // Mock input
    mockInput.enqueueKey(KEY_RETURN_CUSTOM);

    auto modifiedFields = fieldEditor.select(fieldNames, fieldValues, title);

    // Vérifier que les champs originaux sont renvoyés (aucune modification)
    TEST_ASSERT_EQUAL(3, modifiedFields.size());
    TEST_ASSERT_EQUAL_STRING("John", modifiedFields[0].c_str());
    TEST_ASSERT_EQUAL_STRING("30", modifiedFields[1].c_str());
    TEST_ASSERT_EQUAL_STRING("john@example.com", modifiedFields[2].c_str());

    TEST_ASSERT_TRUE(mockView.topBarCalled);
    TEST_ASSERT_TRUE(mockView.verticalSelectionCalled);
    TEST_ASSERT_EQUAL_STRING(title.c_str(), mockView.lastTitle.c_str());
}

#endif // TEST_FIELD_EDITOR_SELECTOR_H
