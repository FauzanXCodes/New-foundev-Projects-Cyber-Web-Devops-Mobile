#ifndef TEST_SD_SERVICE
#define TEST_SD_SERVICE

#include <unity.h>
#include "../src/Services/SdService.h"

void test_sd_begin() {
    SdService sdService;
    TEST_ASSERT_FALSE(sdService.getSdState());
    bool result = sdService.begin();
    TEST_ASSERT_EQUAL(result, sdService.getSdState());
}

void test_sd_close() {
    SdService sdService;
    sdService.close();
    TEST_ASSERT_FALSE(sdService.getSdState());
}

void test_isFile() {
    SdService sdService;
    sdService.begin();
    TEST_ASSERT_FALSE(sdService.isFile("/non_existent.txt"));
    sdService.writeFile("/unitTestFile.txt", "Hello");
    TEST_ASSERT_TRUE(sdService.isFile("/unitTestFile.txt"));
    sdService.deleteFile("/unitTestFile.txt");
    sdService.close();
}

void test_isDirectory() {
    SdService sdService;
    sdService.begin();
    TEST_ASSERT_FALSE(sdService.isDirectory("/non_existent_dir"));
    sdService.ensureDirectory("/unitTestDir");
    TEST_ASSERT_TRUE(sdService.isDirectory("/unitTestDir"));
    sdService.deleteFile("/unitTestDir");
    sdService.close();
}

void test_read_write_file() {
    SdService sdService;
    sdService.begin();
    std::string content = "Test content";
    TEST_ASSERT_TRUE(sdService.writeFile("/unitTest.txt", content));
    std::string readContent = sdService.readFile("/unitTest.txt");
    TEST_ASSERT_EQUAL_STRING(content.c_str(), readContent.c_str());
    sdService.deleteFile("/unitTest.txt");
    sdService.close();
}

void test_append_to_file() {
    SdService sdService;
    sdService.begin();
    sdService.writeFile("/unitTestAppend.txt", "Hello");
    sdService.appendToFile("/unitTestAppend.txt", " World");
    std::string content = sdService.readFile("/unitTestAppend.txt");
    TEST_ASSERT_EQUAL_STRING("Hello World", content.c_str());
    sdService.deleteFile("/unitTestAppend.txt");
    sdService.close();
}

void test_list_elements() {
    SdService sdService;
    sdService.begin();
    sdService.ensureDirectory("/unitTestDir");
    sdService.writeFile("/unitTestDir/file1.txt", "content1");
    sdService.writeFile("/unitTestDir/file2.txt", "content2");
    std::vector<std::string> elements = sdService.listElements("/unitTestDir");
    TEST_ASSERT_EQUAL(2, elements.size());
    sdService.deleteFile("/unitTestDir/file1.txt");
    sdService.deleteFile("/unitTestDir/file2.txt");
    sdService.deleteFile("/unitTestDir");
    sdService.close();
}

void test_getFileName() {
    SdService service;

    std::string path1 = "/folder/subfolder/file.txt";
    std::string path2 = "/folder/file";
    std::string path3 = "file";

    TEST_ASSERT_EQUAL_STRING("file", service.getFileName(path1).c_str());
    TEST_ASSERT_EQUAL_STRING("file", service.getFileName(path2).c_str());
    TEST_ASSERT_EQUAL_STRING("file", service.getFileName(path3).c_str());
}

void test_getFileExt() {
    SdService service;

    std::string path1 = "/folder/subfolder/file.txt";
    std::string path2 = "/folder/file.tar.gz";
    std::string path3 = "/folder/file";

    TEST_ASSERT_EQUAL_STRING("txt", service.getFileExt(path1).c_str());
    TEST_ASSERT_EQUAL_STRING("gz", service.getFileExt(path2).c_str());
    TEST_ASSERT_EQUAL_STRING("", service.getFileExt(path3).c_str());
}

void test_getParentDirectory() {
    SdService service;

    std::string path1 = "/folder/subfolder/file.txt";
    std::string path2 = "/folder/file";
    std::string path3 = "file";
    std::string path4 = "/";

    TEST_ASSERT_EQUAL_STRING("/folder/subfolder", service.getParentDirectory(path1).c_str());
    TEST_ASSERT_EQUAL_STRING("/folder", service.getParentDirectory(path2).c_str());
    TEST_ASSERT_EQUAL_STRING("/", service.getParentDirectory(path3).c_str());
    TEST_ASSERT_EQUAL_STRING("/", service.getParentDirectory(path4).c_str());
}

void test_validateVaultFile() {
    SdService service;

    std::string validVaultPath = "/vaults/myVault.vault";
    std::string invalidVaultPath1 = "/vaults/myVault.txt";
    std::string invalidVaultPath2 = "/vaults/myVault.";

    TEST_ASSERT_TRUE(service.validateVaultFile(validVaultPath));
    TEST_ASSERT_FALSE(service.validateVaultFile(invalidVaultPath1));
    TEST_ASSERT_FALSE(service.validateVaultFile(invalidVaultPath2));
}

#endif // TEST_SD_SERVICE
