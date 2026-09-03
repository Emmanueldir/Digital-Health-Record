const errorHandler = (error, req, res, next) => {
    console.error("Unhandled error:", error);

    const statusCode = error.statusCode || 500;
    const isProduction = process.env.NODE_ENV === "production";

    const message =
        statusCode === 500
            ? error.message || "Internal server error"
            : error.message;

    return res.status(statusCode).json({
        success: false,
        message,
        ...(isProduction || statusCode === 500 ? {} : { stack: error.stack }),
    });
};

module.exports = errorHandler;
