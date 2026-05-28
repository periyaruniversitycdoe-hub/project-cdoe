const service = require('../services/emailService.service');

exports.getServices = async (req, res) => {
    try {
        const data = await service.getAllServices();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getService = async (req, res) => {
    try {
        const data = await service.getServiceById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Service not found' });
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addService = async (req, res) => {
    try {
        const id = await service.createService(req.body);
        res.status(201).json({ success: true, message: 'Service created successfully', id });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Service key must be unique' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.editService = async (req, res) => {
    try {
        await service.updateService(req.params.id, req.body);
        res.json({ success: true, message: 'Service updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.removeService = async (req, res) => {
    try {
        await service.deleteService(req.params.id);
        res.json({ success: true, message: 'Service deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.toggleStatus = async (req, res) => {
    try {
        await service.toggleServiceStatus(req.params.id, req.body.is_active);
        res.json({ success: true, message: `Service ${req.body.is_active ? 'enabled' : 'disabled'} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
