// Standard API response formats
class ApiResponse {
  constructor(success = true, message = '', data = null, error = null) {
    this.success = success;
    this.message = message;
    this.timestamp = new Date().toISOString();
    
    if (data !== null) {
      this.data = data;
    }
    
    if (error !== null) {
      this.error = error;
    }
  }

  static success(message = 'Success', data = null) {
    return new ApiResponse(true, message, data);
  }

  static error(message = 'Error', error = null) {
    return new ApiResponse(false, message, null, error);
  }

  static created(message = 'Resource created successfully', data = null) {
    return new ApiResponse(true, message, data);
  }

  static notFound(message = 'Resource not found') {
    return new ApiResponse(false, message, null, { code: 'NOT_FOUND' });
  }

  static unauthorized(message = 'Unauthorized access') {
    return new ApiResponse(false, message, null, { code: 'UNAUTHORIZED' });
  }

  static forbidden(message = 'Access forbidden') {
    return new ApiResponse(false, message, null, { code: 'FORBIDDEN' });
  }

  static validationError(message = 'Validation failed', details = []) {
    return new ApiResponse(false, message, null, { 
      code: 'VALIDATION_ERROR',
      details 
    });
  }

  static serverError(message = 'Internal server error') {
    return new ApiResponse(false, message, null, { code: 'SERVER_ERROR' });
  }
}

// Pagination response format
class PaginatedResponse extends ApiResponse {
  constructor(data, pagination, message = 'Success') {
    super(true, message, data);
    this.pagination = {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      total: pagination.total || 0,
      totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
      hasNext: pagination.page < Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
      hasPrev: pagination.page > 1
    };
  }
}

module.exports = {
  ApiResponse,
  PaginatedResponse
};