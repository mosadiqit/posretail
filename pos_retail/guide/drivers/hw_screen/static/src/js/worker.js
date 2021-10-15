    $(function() {
        "use strict";
        // mergedHead will be turned to true the first time we receive something from a new host
        // It allows to transform the <head> only once
        var mergedHead = false;
        var current_client_url = "";
        var stop_longpolling = false;

        function longpolling() {
            $.ajax({
                type: 'POST',
                url: 'http://'+window.location.host+'/point_of_sale/get_serialized_order',
                dataType: 'json',
                beforeSend: function(xhr){xhr.setRequestHeader('Content-Type', 'application/json');},
                data: JSON.stringify({jsonrpc: '2.0'}),

                success: function(data) {
                    if (typeof data.result.stop_longpolling !== 'undefined') {
                        stop_longpolling = data.result.stop_longpolling;
                    }
                    if (data.result.ip_from && data.result.rendered_html) {
                        var trimmed = $.trim(data.result.rendered_html);
                        var $parsedHTML = $('<div>').html($.parseHTML(trimmed,true)); // WARNING: the true here will executes any script present in the string to parse
                        var new_client_url = $parsedHTML.find(".resources > base").attr('href');
    
                        if (!mergedHead || (current_client_url !== new_client_url)) {
    
                            mergedHead = true;
                            current_client_url = new_client_url;
                            $("body").removeClass('original_body').addClass('ajax_got_body');
                            $("head").children().not('.origin').remove();
                            $("head").append($parsedHTML.find(".resources").html());
                        } 
    
                        $(".container").html($parsedHTML.find('.pos-customer_facing_display').html());
                        $(".container").attr('class', 'container').addClass($parsedHTML.find('.pos-customer_facing_display').attr('class'));
    
                        var d = $('.pos_orderlines_list');
                        d.scrollTop(d.prop("scrollHeight"));
                        
                        // Here we execute the code coming from the pos, apparently $.parseHTML() executes scripts right away,
                        // Since we modify the dom afterwards, the script might not have any effect
                        if (typeof foreign_js !== 'undefined' && $.isFunction(foreign_js)) {
                            foreign_js();
                        }
                    }
                },

                complete: function(jqXHR,err) {
                    if (!stop_longpolling) {
                        longpolling();
                    }
                },

                timeout: 30000,
            });
        };

        function retail_longpolling() {
            $.ajax({
                type: 'POST',
                url: window.location.origin + '/pos/get-login-chef',
                dataType: 'json',
                beforeSend: function (xhr) {
                    xhr.setRequestHeader('Content-Type', 'application/json');
                },
                data: JSON.stringify({jsonrpc: '2.0'}),
                success: function (data) {
                    if (typeof data.result.link == 'undefined') {
                        setTimeout(retail_longpolling, 5000);
                    } else {
                        var pos_link = data.result['link'] + '/web/login?database=' + data.result['database'] + '&login=' + data.result['login'] + '&password=' + data.result['password'] + '&iot_pos=true';
                        window.open(pos_link, '_self');
                    }
                },
                error: function (jqXHR, status, err) {
                    if (!stop_longpolling) {
                        setTimeout(retail_longpolling, 5000);
                    }
                },
                timeout: 30000,
            });
        }
        retail_longpolling();
        longpolling();
    });