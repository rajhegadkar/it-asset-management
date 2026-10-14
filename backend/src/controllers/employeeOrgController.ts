import { Request, Response, NextFunction } from 'express';
import { EmployeeService } from '../services/employeeService.js';
import { DepartmentLocationVendorService } from '../services/departmentLocationVendorService.js';
import { ApiResponse } from '../utils/apiResponse.js';

export class EmployeeController {
  static async getEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, departmentId, locationId, status, page, limit } = req.query;
      const result = await EmployeeService.getEmployees({
        search: search as string,
        departmentId: departmentId as string,
        locationId: locationId as string,
        status: status as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });
      return ApiResponse.success(res, result.employees, 'Employees retrieved', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  static async getEmployeeById(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await EmployeeService.getEmployeeById(req.params.id);
      return ApiResponse.success(res, employee, 'Employee details retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async createEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await EmployeeService.createEmployee(req.body);
      return ApiResponse.success(res, employee, 'Employee profile created', 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await EmployeeService.updateEmployee(req.params.id, req.body);
      return ApiResponse.success(res, updated, 'Employee profile updated');
    } catch (error) {
      next(error);
    }
  }
}

export class OrgDataController {
  static async getDepartments(req: Request, res: Response, next: NextFunction) {
    try {
      const depts = await DepartmentLocationVendorService.getDepartments();
      return ApiResponse.success(res, depts, 'Departments retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async createDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const dept = await DepartmentLocationVendorService.createDepartment(req.body);
      return ApiResponse.success(res, dept, 'Department created', 201);
    } catch (error) {
      next(error);
    }
  }

  static async getLocations(req: Request, res: Response, next: NextFunction) {
    try {
      const locs = await DepartmentLocationVendorService.getLocations();
      return ApiResponse.success(res, locs, 'Locations retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async createLocation(req: Request, res: Response, next: NextFunction) {
    try {
      const loc = await DepartmentLocationVendorService.createLocation(req.body);
      return ApiResponse.success(res, loc, 'Location created', 201);
    } catch (error) {
      next(error);
    }
  }

  static async getVendors(req: Request, res: Response, next: NextFunction) {
    try {
      const vendors = await DepartmentLocationVendorService.getVendors();
      return ApiResponse.success(res, vendors, 'Vendors retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async createVendor(req: Request, res: Response, next: NextFunction) {
    try {
      const vendor = await DepartmentLocationVendorService.createVendor(req.body);
      return ApiResponse.success(res, vendor, 'Vendor registered', 201);
    } catch (error) {
      next(error);
    }
  }

  static async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const cats = await DepartmentLocationVendorService.getCategories();
      return ApiResponse.success(res, cats, 'Categories retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const cat = await DepartmentLocationVendorService.createCategory(req.body);
      return ApiResponse.success(res, cat, 'Category created', 201);
    } catch (error) {
      next(error);
    }
  }
}
