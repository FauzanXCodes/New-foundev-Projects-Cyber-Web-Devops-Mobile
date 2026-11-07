#ifndef TEST_CRYPTO_SERVICE
#define TEST_CRYPTO_SERVICE

#include <unity.h>
#include "../src/Services/CryptoService.h"

void test_generateHardwareRandom() {
    CryptoService service;
    size_t size = 16;

    auto randomData = service.generateHardwareRandom(size);

    TEST_ASSERT_EQUAL(size, randomData.size());

    // Verify randomness
    bool hasVariety = false;
    for (size_t i = 1; i < randomData.size(); ++i) {
        if (randomData[i] != randomData[0]) {
            hasVariety = true;
            break;
        }
    }

    TEST_ASSERT_TRUE_MESSAGE(hasVariety, "Hardware random data lacks variety.");
}

void test_generateRandomString() {
    CryptoService service;
    size_t length = 18;
    const std::string PRINTABLE_CHARACTERS =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "abcdefghijklmnopqrstuvwxyz"
        "0123456789"
        "!@#$&*-_=+";

    auto randomString = service.generateRandomString(length);

    TEST_ASSERT_EQUAL(length, randomString.size());

    // Verify each chars members of PRINTABLE_CHARACTERS
    for (char c : randomString) {
        TEST_ASSERT_NOT_EQUAL(std::string::npos, PRINTABLE_CHARACTERS.find(c));
    }
}

void test_deriveKeyFromPassphrase() {
    CryptoService service;
    std::string passphrase = "strongpassword";
    std::string salt = "randomsalt";
    size_t keySize = 16;

    auto key = service.deriveKeyFromPassphrase(passphrase, salt, keySize);

    TEST_ASSERT_EQUAL(keySize, key.size());
}

void test_encrypt_decrypt_AES() {
    CryptoService service;
    std::vector<uint8_t> key(16, 0x01); // Key with 16 bytes of 0x01
    std::vector<uint8_t> data = {0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
                                 0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF};

    auto encrypted = service.encryptAES(data, key);
    auto decrypted = service.decryptAES(encrypted, key);

    TEST_ASSERT_EQUAL_MEMORY(data.data(), decrypted.data(), data.size());
}

void test_generateSalt() {
    CryptoService service;
    size_t saltSize = 16;

    auto salt = service.generateSalt(saltSize);

    TEST_ASSERT_EQUAL(saltSize, salt.size());

    // Vérifie que tous les octets ne sont pas identiques (ex: 0x00 ou 0xFF partout)
    bool hasVariety = false;
    for (size_t i = 1; i < salt.size(); ++i) {
        if (salt[i] != salt[0]) {
            hasVariety = true;
            break;
        }
    }

    TEST_ASSERT_TRUE_MESSAGE(hasVariety, "Salt does not contain a variety of values.");
}

void test_generateChecksum() {
    CryptoService service;
    std::string data = "RandomData";
    size_t checksumSize = 16;

    auto checksum = service.generateChecksum(data, checksumSize);

    TEST_ASSERT_EQUAL(checksumSize, checksum.size());
    TEST_ASSERT_NOT_EQUAL(0, checksum[0]); // Vérifie que le checksum n'est pas vide
}

void test_encrypt_decrypt_with_passphrase() {
    CryptoService service;
    std::string passphrase = "strongpassword";
    std::string data = "random";
    const std::vector<uint8_t> salt = {0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
                                 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10};

    auto encrypted = service.encryptWithPassphrase(data, passphrase, salt);
    auto decrypted = service.decryptWithPassphrase(encrypted, passphrase, salt);

    TEST_ASSERT_EQUAL_MEMORY(data.data(), decrypted.data(), data.size());
}

#endif // TEST_CRYPTO_SERVICE
