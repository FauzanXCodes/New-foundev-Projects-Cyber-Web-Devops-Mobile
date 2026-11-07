#ifndef MOCK_INPUT_H
#define MOCK_INPUT_H

#include <queue>
#include "../src/Inputs/IInput.h"

class MockInput : public IInput {
public:
    MockInput() {}

    // Queue to mock input
    void enqueueKey(char key) {
        inputQueue.push(key);
    }

    char handler() override {
        if (inputQueue.empty()) {
            return KEY_NONE;
        }
        char key = inputQueue.front();
        inputQueue.pop();
        return key;
    }

    void waitPress() override {}

private:
    std::queue<char> inputQueue;
};

#endif // MOCK_INPUT_H
