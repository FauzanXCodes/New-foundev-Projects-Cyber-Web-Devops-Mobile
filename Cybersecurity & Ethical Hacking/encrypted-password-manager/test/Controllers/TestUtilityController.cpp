#ifndef TEST_UTILITY_CONTROLLER
#define TEST_UTILITY_CONTROLLER

#include <unity.h>
#include "../src/Controllers/UtilityController.h"
#include "../src/Services/NvsService.h"
#include "../src/Services/UsbService.h"
#include "../src/Services/LedService.h"
#include "../src/Services/SdService.h"
#include "../src/Selectors/HorizontalSelector.h"
#include "../src/Selectors/VerticalSelector.h"
#include "../src/Selectors/FieldEditorSelector.h"
#include "../src/Selectors/StringPromptSelector.h"
#include "../src/Selectors/ConfirmationSelector.h"
#include "../src/Managers/InactivityManager.h"
#include "../src/Transformers/TimeTransformer.h"
#include "../Views/MockView.h"
#include "../Inputs/MockInput.h"

void test_handleGeneralSettings() {
    MockView mockDisplay;
    MockInput mockInput;
    NvsService nvsService;
    UsbService usbService;
    LedService ledService;
    SdService sdService;
    InactivityManager inactivityManager(mockDisplay);
    TimeTransformer timeTransformer;

    HorizontalSelector horizontalSelector(mockDisplay, mockInput, inactivityManager);
    VerticalSelector verticalSelector(mockDisplay, mockInput, inactivityManager);
    FieldEditorSelector fieldEditorSelector(mockDisplay, mockInput);
    StringPromptSelector stringPromptSelector(mockDisplay, mockInput);
    ConfirmationSelector confirmationSelector(mockDisplay, mockInput);

    UtilityController controller(mockDisplay, mockInput, horizontalSelector, verticalSelector,
                                 fieldEditorSelector, stringPromptSelector, confirmationSelector,
                                 usbService, ledService, nvsService, sdService, timeTransformer);

    // Not really usefull to test it
    TEST_ASSERT_TRUE(true);
}

#endif // TEST_UTILITY_CONTROLLER
