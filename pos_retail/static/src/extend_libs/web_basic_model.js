odoo.define('pos_retail.web_basic_model', function (require) {
    "use strict";

    var basic_model = require('web.BasicModel');

    basic_model.include({
        _buildOnchangeSpecs: function (record, viewType) {
            var hasOnchange = false;
            var specs = {};
            var fieldsInfo = record.fieldsInfo[viewType || record.viewType];
            generateSpecs(fieldsInfo, record.fields);
            function generateSpecs(fieldsInfo, fields, prefix) {
                prefix = prefix || '';
                _.each(Object.keys(fieldsInfo), function (name) {
                    var field = fields[name];
                    var fieldInfo = fieldsInfo[name];
                    var key = prefix + name;
                    if (field) {
                        specs[key] = (field.onChange) || "";
                        if (field.onChange) {
                            hasOnchange = true;
                        }
                        _.each(fieldInfo.views, function (view) {
                            generateSpecs(view.fieldsInfo[view.type], view.fields, key + '.');
                        });
                    } else {
                        console.warn(name + ' field not found');
                    }
                });
            }

            return hasOnchange ? specs : false;
        },
    })
});
