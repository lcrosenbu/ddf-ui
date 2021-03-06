/**
 * Copyright (c) Codice Foundation
 *
 * This is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
 * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details. A copy of the GNU Lesser General Public License
 * is distributed along with this program and can be found at
 * <http://www.gnu.org/licenses/lgpl.html>.
 *
 **/
/*global define*/
define([
    'marionette',
    'underscore',
    'jquery',
    '../editor.view',
    'js/store',
    'component/property/property.collection.view',
    'component/loading-companion/loading-companion.view',
    'component/alert/alert',
    'component/singletons/metacard-definitions'
], function (Marionette, _, $, EditorView, store, PropertyCollectionView, LoadingCompanionView,
             alertInstance, metacardDefinitions) {

    return EditorView.extend({
        className: 'is-metacard-basic',
        setDefaultModel: function(){
            this.model = this.selectionInterface.getSelectedResults();
        },
        selectionInterface: store,
        initialize: function(options){
            this.selectionInterface = options.selectionInterface || this.selectionInterface;
            EditorView.prototype.initialize.call(this, options);
            this.listenTo(this.model.first().get('metacard').get('properties'), 'change', this.onBeforeShow);
        },
        onBeforeShow: function() {
            this.editorProperties.show(PropertyCollectionView.generateSummaryPropertyCollectionView(
                [this.model.first().get('propertyTypes')],
                [this.model.first().get('metacard>properties').toJSON()]));
            this.editorProperties.currentView.turnOnLimitedWidth();
            this.editorProperties.currentView.$el.addClass("is-list");

            this.getValidation();
        },
        getValidation: function(){
            var self = this;
            self.editorProperties.currentView.clearValidation();
            $.get({
                url: '/search/catalog/internal/metacard/'+this.model.first().get('metacard').id+'/attribute/validation',
                customErrorHandling: true
            }).then(function(response){
                if (!self.isDestroyed && self.editorProperties.currentView){
                    self.editorProperties.currentView.updateValidation(response);
                }
            }).always(function(){
                if (!self.isDestroyed){

                }
            });
        },
        afterCancel: function(){

        },
        afterSave: function(editorJSON){
           if (editorJSON.length > 0){
               var payload = [
                   {
                       ids: [this.model.first().get('metacard').get('id')],
                       attributes: editorJSON
                   }
               ];
               LoadingCompanionView.beginLoading(this);
               var self = this;
               setTimeout(function(){
                   $.ajax({
                       url: '/search/catalog/internal/metacards',
                       type: 'PATCH',
                       data: JSON.stringify(payload),
                       contentType: 'application/json'
                   }).always(function(response){
                       var attributeMap = response.reduce(function(attributeMap, changes){
                           return changes.attributes.reduce(function(attrMap, chnges){
                               attrMap[chnges.attribute] = metacardDefinitions.metacardTypes[chnges.attribute].multivalued ? chnges.values : chnges.values[0];
                               return attrMap;
                           }, attributeMap);
                       }, {});
                       self.model.first().get('metacard').get('properties').set(attributeMap);
                       store.get('workspaces').forEach(function(workspace){
                           workspace.get('queries').forEach(function(query){
                               if (query.get('result')) {
                                   query.get('result').get('results').forEach(function(result){
                                       if (result.get('metacard').get('properties').get('id') ===  self.model.first().get('metacard').get('properties').get('id')){
                                           result.get('metacard').get('properties').set(attributeMap);
                                       }
                                   });
                               }
                           });
                       });
                       alertInstance.get('currentResult').get('results').forEach(function(result){
                           if (result.get('metacard').get('properties').get('id') ===  self.model.first().get('metacard').get('properties').get('id')){
                               result.get('metacard').get('properties').set(attributeMap);
                           }
                       });
                       setTimeout(function(){  //let solr flush
                          LoadingCompanionView.endLoading(self);
                           self.getValidation();
                       }, 1000);
                   });
               }, 1000);
           }
        }
    });
});
