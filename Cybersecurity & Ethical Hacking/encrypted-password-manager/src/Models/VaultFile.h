#ifndef VAULT_FILE_H
#define VAULT_FILE_H

#include <string>
#include <vector>
#include <States/GlobalState.h>

class VaultFile {
private:
    std::string path; 
    std::vector<uint8_t> data; // raw data (salt + checksum + encryted data)

    GlobalState& globalState = GlobalState::getInstance();

public:
    // Constructeur
    VaultFile(const std::string& filePath, const std::vector<uint8_t>& rawData)
        : path(filePath), data(rawData) {}

    // Accesseurs
    const std::string& getPath() const { return path; }

    std::vector<uint8_t> getSalt() const {
        size_t saltSize = globalState.getSaltSize();
        if (data.size() >= saltSize) {
            return {data.begin(), data.begin() + saltSize};
        }
        return {};
    }

    std::vector<uint8_t> getChecksum() const {
        size_t saltSize = globalState.getSaltSize();
        size_t checksumSize = globalState.getChecksumSize();
        if (data.size() >= saltSize + checksumSize) {
            return {data.begin() + saltSize, data.begin() + saltSize + checksumSize};
        }
        return {};
    }

    std::vector<uint8_t> getData() const {
        return data;
    }

    std::vector<uint8_t> getEncryptedData() const {
        size_t saltSize = globalState.getSaltSize();
        size_t checksumSize = globalState.getChecksumSize();
        if (data.size() > saltSize + checksumSize) {
            return {data.begin() + saltSize + checksumSize, data.end()};
        }
        return {};
    }

    // Mutateurs
    void setPath(const std::string& filePath) { path = filePath; }

    void setData(const std::vector<uint8_t>& rawData) { data = rawData; }

    void setSalt(const std::vector<uint8_t>& salt) {
        data.insert(data.begin(), salt.begin(), salt.end());
    }

    void setChecksum(const std::vector<uint8_t>& checksum) {
        size_t saltSize = globalState.getSaltSize();
        data.insert(data.begin() + saltSize, checksum.begin(), checksum.end());
    }

    void setEncryptedData(const std::vector<uint8_t>& encryptedData) {
        size_t saltSize = globalState.getSaltSize();
        size_t checksumSize = globalState.getChecksumSize();

        if (data.size() < saltSize + checksumSize) {
            data.resize(saltSize + checksumSize, 0); // Initialize with 0
        }

        // Erase old data
        data.erase(data.begin() + saltSize + checksumSize, data.end());

        // Add new data
        data.insert(data.end(), encryptedData.begin(), encryptedData.end());
    }

};

#endif // VAULT_FILE_H
