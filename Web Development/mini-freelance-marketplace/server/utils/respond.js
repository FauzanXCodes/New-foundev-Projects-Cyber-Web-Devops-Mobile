export const respond = (res, message, statuscode, success, data = null) => {
    const response = { message, success, status: statuscode };
    if (data !== null) {
        response.data = data;
    }
    res.status(response.status).json(response);
};