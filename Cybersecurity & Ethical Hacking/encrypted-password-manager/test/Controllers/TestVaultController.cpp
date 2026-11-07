#ifndef TEST_VAULT_CONTROLLER
#define TEST_VAULT_CONTROLLER

#include <unity.h>
#include "../src/Controllers/VaultController.h"
#include "../src/Services/NvsService.h"
#include "../src/Services/CategoryService.h"
#include "../src/Services/EntryService.h"
#include "../src/Services/CryptoService.h"
#include "../src/Services/SdService.h"
#include "../src/Transformers/JsonTransformer.h"
#include "../src/States/GlobalState.h"
#include "../src/Transformers/ModelTransformer.h"
#include "../src/Repositories/EntryRepository.h"
#include "../src/Repositories/CategoryRepository.h"
#include "../src/Selectors/StringPromptSelector.h"
#include "../src/Selectors/VerticalSelector.h"
#include "../src/Selectors/HorizontalSelector.h"
#include "../src/Selectors/ConfirmationSelector.h"
#include "../src/Managers/InactivityManager.h"
#include "../src/Models/Category.h"
#include "../src/Models/Entry.h"
#include "../Views/MockView.h"
#include "../Inputs/MockInput.h"

void test_actionNoVault() {
    MockView mockDisplay;
    MockInput mockInput;
    NvsService nvsService;
    SdService sdService;
    EntryRepository entryRepository;
    CategoryRepository categoryRepository;
    EntryService entryService(entryRepository);
    CategoryService categoryService(categoryRepository);
    CryptoService cryptoService;
    JsonTransformer jsonTransformer;
    ModelTransformer modelTransformer;
    InactivityManager inactivityManager(mockDisplay);

    StringPromptSelector stringPromptSelector(mockDisplay, mockInput);
    VerticalSelector verticalSelector(mockDisplay, mockInput, inactivityManager);
    HorizontalSelector horizontalSelector(mockDisplay, mockInput, inactivityManager);
    ConfirmationSelector confirmationSelector(mockDisplay, mockInput);

    VaultController controller(mockDisplay, mockInput, horizontalSelector, verticalSelector,
                               confirmationSelector, stringPromptSelector, sdService,
                               nvsService, categoryService, entryService, cryptoService,
                               jsonTransformer, modelTransformer);

    // Simuler "Create Vault" press
    mockInput.enqueueKey(KEY_OK);

    ActionEnum action = controller.actionNoVault();

    TEST_ASSERT_EQUAL(ActionEnum::OpenVault, action);
}

void test_actionVaultSelected() {
    MockView mockDisplay;
    MockInput mockInput;
    NvsService nvsService;
    SdService sdService;
    EntryRepository entryRepository;
    CategoryRepository categoryRepository;
    EntryService entryService(entryRepository);
    CategoryService categoryService(categoryRepository);
    CryptoService cryptoService;
    JsonTransformer jsonTransformer;
    ModelTransformer modelTransformer;
    InactivityManager inactivityManager(mockDisplay);

    StringPromptSelector stringPromptSelector(mockDisplay, mockInput);
    VerticalSelector verticalSelector(mockDisplay, mockInput, inactivityManager);
    HorizontalSelector horizontalSelector(mockDisplay, mockInput, inactivityManager);
    ConfirmationSelector confirmationSelector(mockDisplay, mockInput);

    VaultController controller(mockDisplay, mockInput, horizontalSelector, verticalSelector,
                               confirmationSelector, stringPromptSelector, sdService,
                               nvsService, categoryService, entryService, cryptoService,
                               jsonTransformer, modelTransformer);

    // Simuler "Create Entry" press
    mockInput.enqueueKey(KEY_OK);

    ActionEnum action = controller.actionVaultSelected();

    TEST_ASSERT_EQUAL(ActionEnum::SelectEntry, action);
}

void test_handleVaultCreation() {
    MockView mockDisplay;
    MockInput mockInput;
    NvsService nvsService;
    SdService sdService;
    EntryRepository entryRepository;
    CategoryRepository categoryRepository;
    EntryService entryService(entryRepository);
    CategoryService categoryService(categoryRepository);
    CryptoService cryptoService;
    JsonTransformer jsonTransformer;
    ModelTransformer modelTransformer;
    InactivityManager inactivityManager(mockDisplay);
    GlobalState& globalState = GlobalState::getInstance();

    StringPromptSelector stringPromptSelector(mockDisplay, mockInput);
    VerticalSelector verticalSelector(mockDisplay, mockInput, inactivityManager);
    HorizontalSelector horizontalSelector(mockDisplay, mockInput, inactivityManager);
    ConfirmationSelector confirmationSelector(mockDisplay, mockInput);

    VaultController controller(mockDisplay, mockInput, horizontalSelector, verticalSelector,
                               confirmationSelector, stringPromptSelector, sdService,
                               nvsService, categoryService, entryService, cryptoService,
                               jsonTransformer, modelTransformer);

    // Vault Name
    mockInput.enqueueKey('U');
    mockInput.enqueueKey('n');
    mockInput.enqueueKey('i');
    mockInput.enqueueKey('t');
    mockInput.enqueueKey('T');
    mockInput.enqueueKey('e');
    mockInput.enqueueKey('s');
    mockInput.enqueueKey('t');
    mockInput.enqueueKey(KEY_OK);

    // Ensure UnitTest vault file is deleted before create a new one
    auto unitTestVaultPath = globalState.getDefaultVaultPath() + "/UnitTest.vault";
    sdService.begin();
    if (sdService.isFile(unitTestVaultPath)) {
        mockInput.enqueueKey(KEY_OK); // confirm deletion during creation process
    }
    sdService.close();


    // Pass1
    mockInput.enqueueKey('M');
    mockInput.enqueueKey('y');
    mockInput.enqueueKey('P');
    mockInput.enqueueKey('a');
    mockInput.enqueueKey('s');
    mockInput.enqueueKey('s');
    mockInput.enqueueKey(KEY_OK);

    // Pass2
    mockInput.enqueueKey('M');
    mockInput.enqueueKey('y');
    mockInput.enqueueKey('P');
    mockInput.enqueueKey('a');
    mockInput.enqueueKey('s');
    mockInput.enqueueKey('s');
    mockInput.enqueueKey(KEY_OK);

    bool result = controller.handleVaultCreation();

    TEST_ASSERT_TRUE(result);
}

void test_handleVaultLoading() {
    MockView mockDisplay;
    MockInput mockInput;
    NvsService nvsService;
    SdService sdService;
    EntryRepository entryRepository;
    CategoryRepository categoryRepository;
    EntryService entryService(entryRepository);
    CategoryService categoryService(categoryRepository);
    CryptoService cryptoService;
    JsonTransformer jsonTransformer;
    ModelTransformer modelTransformer;
    InactivityManager inactivityManager(mockDisplay);

    StringPromptSelector stringPromptSelector(mockDisplay, mockInput);
    VerticalSelector verticalSelector(mockDisplay, mockInput, inactivityManager);
    HorizontalSelector horizontalSelector(mockDisplay, mockInput, inactivityManager);
    ConfirmationSelector confirmationSelector(mockDisplay, mockInput);

    VaultController controller(mockDisplay, mockInput, horizontalSelector, verticalSelector,
                               confirmationSelector, stringPromptSelector, sdService,
                               nvsService, categoryService, entryService, cryptoService,
                               jsonTransformer, modelTransformer);

    // Sélectionner "Load SD Vault"
    mockInput.enqueueKey(KEY_OK);

    // File name in search box
    mockInput.enqueueKey('U');
    mockInput.enqueueKey('n');
    mockInput.enqueueKey('i');
    mockInput.enqueueKey('t');
    mockInput.enqueueKey('T');
    mockInput.enqueueKey('e');
    mockInput.enqueueKey('s');
    mockInput.enqueueKey('t');
    mockInput.enqueueKey(KEY_OK);

    // Password
    mockInput.enqueueKey('M');
    mockInput.enqueueKey('y');
    mockInput.enqueueKey('P');
    mockInput.enqueueKey('a');
    mockInput.enqueueKey('s');
    mockInput.enqueueKey('s');
    mockInput.enqueueKey(KEY_OK);

    bool result = controller.handleVaultLoading();

    TEST_ASSERT_TRUE(result);
}

void test_handleVaultSave() {
    MockView mockDisplay;
    MockInput mockInput;
    NvsService nvsService;
    SdService sdService;
    EntryRepository entryRepository;
    CategoryRepository categoryRepository;
    EntryService entryService(entryRepository);
    CategoryService categoryService(categoryRepository);
    CryptoService cryptoService;
    JsonTransformer jsonTransformer;
    ModelTransformer modelTransformer;
    InactivityManager inactivityManager(mockDisplay);
    GlobalState& globalState = GlobalState::getInstance();

    StringPromptSelector stringPromptSelector(mockDisplay, mockInput);
    VerticalSelector verticalSelector(mockDisplay, mockInput, inactivityManager);
    HorizontalSelector horizontalSelector(mockDisplay, mockInput, inactivityManager);
    ConfirmationSelector confirmationSelector(mockDisplay, mockInput);

    VaultController controller(mockDisplay, mockInput, horizontalSelector, verticalSelector,
                               confirmationSelector, stringPromptSelector, sdService,
                               nvsService, categoryService, entryService, cryptoService,
                               jsonTransformer, modelTransformer);

    std::vector<Entry> entries = {Entry("Service1", "User1", "Pass1", "Note")};
    std::vector<Category> cats = {Category()};
    entryService.setEntries(entries);
    categoryService.setCategories(cats);
    globalState.setLoadedVaultPath(globalState.getDefaultVaultPath() + "/UnitTest.vault");
    globalState.setLoadedVaultPassword("MyPass");

    bool result = controller.handleVaultSave();

    TEST_ASSERT_TRUE(result);
}

void test_handleVaultSave_maxEntries() {
    MockView mockDisplay;
    MockInput mockInput;
    NvsService nvsService;
    SdService sdService;
    EntryRepository entryRepository;
    CategoryRepository categoryRepository;
    EntryService entryService(entryRepository);
    CategoryService categoryService(categoryRepository);
    CryptoService cryptoService;
    JsonTransformer jsonTransformer;
    ModelTransformer modelTransformer;
    InactivityManager inactivityManager(mockDisplay);
    GlobalState& globalState = GlobalState::getInstance();

    StringPromptSelector stringPromptSelector(mockDisplay, mockInput);
    VerticalSelector verticalSelector(mockDisplay, mockInput, inactivityManager);
    HorizontalSelector horizontalSelector(mockDisplay, mockInput, inactivityManager);
    ConfirmationSelector confirmationSelector(mockDisplay, mockInput);

    VaultController controller(mockDisplay, mockInput, horizontalSelector, verticalSelector,
                               confirmationSelector, stringPromptSelector, sdService,
                               nvsService, categoryService, entryService, cryptoService,
                               jsonTransformer, modelTransformer);

    // Max entries limit
    auto entryLimit = globalState.getMaxSavedPasswordCount();
    globalState.setLoadedVaultPath(globalState.getDefaultVaultPath() + "/UnitTest.vault");
    globalState.setLoadedVaultPassword("MyPass");
    
    // Full vector of entries
    for (size_t i = 0; i < entryLimit; i++) {
        entryService.addEntry(Entry("Service" + std::to_string(i), "username@123456789.com", "password123456789", "a quite long note for all the entries"));
    }
    bool result = controller.handleVaultSave();

    TEST_ASSERT_TRUE(result);
}



#endif // TEST_VAULT_CONTROLLER
