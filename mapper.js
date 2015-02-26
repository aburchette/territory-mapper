/* Territory Mapper
 * 
 * Alan Burchette
 */

 function Segment(){
	this.points = [];
	this.i = [];
}
function Territory(){
	this.name = null;
	this.segments = [];
}

// global territory management object
var tm = window.tm || {
	// set default variables
	x : null,
	y : null,
	true_x : null,
	true_y : null,
	last_x : null,
	last_y : null,
	last_map_x : null,
	last_map_y : null,
	map_dragging : false,

	// variable to hold empty object to clear board
	// testing only
	clear_object : {},
	clearMap : function(){
		this.o = $.extend(true, {}, this.clear_object);
	},

	// segment object
	// this.o.segments[x].points[x].x
	o : {
		points : [], // list of points - not deleted unless completely saved and refreshed
		segments : [], // reference to points by array number
		territories : {}, // list of territories
		segment_bounds : {
			x1 : null, y1 : null, x2 : null, y2 : null
		},
		map_bounds : {
			x1 : null, y1 : null, x2 : null, y2 : null
		},
		nw_pixel : {},
		preferences : {
			zoom : null,
			center : {
				x : null,
				y : null
			},
			map_type : 'road',
			canvas_width : null,
			canvas_height : null
		}
	},
	segment : {
		points : [],
		i : [] // index to territories
	},
	territory : {
		name : null,
		segments : [],
		geocodes : ''
	},

	// holds geocodes for addresses
	geocodes : null,

	current_segment_id : 1,
	current_territory_id : 1,
	
	map_types : {
		road : google.maps.MapTypeId.ROADMAP,
		hybrid : google.maps.MapTypeId.HYBID,
		satellite : google.maps.MapTypeId.SATELLITE,
		terrain : google.maps.MapTypeId.TERRAIN
	},
	
	steps : [],
	history_steps : 10,
	steps_to_save : 20,
	current_step : 0,
	
	start_box_x : null,
	start_box_y : null,
	start_box_draw : false,
	box_active : false,
	box_selected : false,
	removing_box : false,
	box_w : null,
	box_h : null,
	box_offset_x : null,
	box_offset_y : null,
	inside_box : [],

	spring_to_point : null,
	
	cancel_building_segment_on_up : false,
	ready_to_start_segment_on_point : null,
	add_point_on_up : false,
	ready_to_delete_point : null,
	ready_to_nudge_point : null,
	start_segment : false,
	building_segment : false,
	point_selected : null,
	segment_selected : null,
	which_segment : null,
	on_line : null,
	drawing_from_point : null,
	draw_before_or_after : 'after',
	selected_polygon : null,

	highlight : null,
	highlight_overlaps : {},
	
	segment_cap : 'round',
	box_fill_style : 'rgba(60,90,200,0.1)',
	box_stroke_color : 'rgba(60,90,200,0.3)',
	segment_stroke_color : 'rgba(60,90,200,0.5)',
	no_draw_segment_stroke_color : 'rgba(200,0,0,0.5)',
	plot_geocode_color : 'rgba(200,0,0,0.4)',
	segment_line_width : 6,
	box_line_width : 2,
	point_line_proximity : 7,
	
	extended_canvas_width : null,
	extended_canvas_height : null,
	canvases_offset : {
		x : null,
		y : null
	},
	overflow : 1.1,

	// 0-1 : 0 = no extended canvas, 1 = full height and width
	extended_canvas_size : 0,
	map : null,
	map_options : {},
	projection : null,
	canvas_wrapper : '#canvas_wrapper',
	map_canvas : 'map_canvas',
	canvases : '#canvases',
	mouse_event_canvas : '#mouse_event_canvas',
	box_canvas : '#box_canvas',
	segment_canvas : '#segment_canvas',
	canvas_layers : ['a_canvas', 'b_canvas', 'c_canvas', 'd_canvas', 'e_canvas', 'f_canvas', 'g_canvas', 'h_canvas', 'p1_canvas', 'p2_canvas', 'p3_canvas', 'p4_canvas', 'p5_canvas', 'p6_canvas'],
	l_c : [],
	s_c : null,
	b_c : null,
	me_c : null,
	canvas_colors : ['#f00', '#ff0', '#0f0', '#0ff', '#00f', '#f0f'],
	current_canvas_layer : 0,
	canvas_fill_opacity : '0.1',
	map_overflow : .1,
	map_hidden : false,
	points_hidden : false,
	lines_hidden : false,
	geocodes_hidden : false,
	
	option1_key : 17, // ctrl
	option2_key : 18, // alt
	select_key : 16, // shift
	left_button_down : false,
	right_button_down : false,
	option1_down : false,
	option2_down : false,
	select_down : false,
	build_mode : true,

	deleted : false,

	new_left_territory : false,
	new_right_territory : false,

	// arrays
	out_territories : null,
	immovable_points : [],
	immovable_segments : [],
	all_territory_outlines : false,
	moved_points : {},

	// benchmarking
	startTime : 0,
	endTime : 0,

	//
	save_on_unload : false,
	
	init : function(){
		var self = this;
		var q; // temporary data holder
		
		self.setupCanvases();

		self.loadSegments();

		// future use
		self.loadLocations();

		// catch the mouse wheel
		self.hookScrollEvent();

		self.resetCanvases();

		// TESTING ONLY
		self.clear_object = $.extend(true, {}, self.o);

		// set up event listeners
		//page unload
		$(window).bind('unload',function(){
			if(!self.deleted){
				//self.saveSegments();
			}
		});

		// mouse down
		$(self.mouse_event_canvas).mousedown(function(e){
			// moved here to keep from checking every time the mouse moves
			self.nearPointOrLine();

			e.preventDefault();
			if(e.which === 1){
				$(".lmb").addClass('on');

				self.leftButtonDown();
			} else if(e.which === 2){
				self.middleButtonDown();
			} else if(e.which === 3){
				self.rightButtonDown();
			}
		});
		
		// mouse up anywhere on the page
		$(document).mouseup(function(e){
			e.preventDefault();
			if(e.which === 1){
				$(".lmb").removeClass('on');

				self.leftButtonUp();
			} else if(e.which === 3){
				self.rightButtonUp();
			}
		});
		
		// mouse move - main function is to set x and y
		// 1. if box is being draw (right click)
		// 2. if box is selected (left click)
		// 3. if point is selected
		// 4. if segment is being built 
		$(self.mouse_event_canvas).mousemove(function(e){
			self.last_x = self.x;
			self.last_y = self.y;
			self.x = e.pageX - $(self.mouse_event_canvas).offset().left;
			self.y = e.pageY - $(self.mouse_event_canvas).offset().top;
			self.true_x = self.x - parseInt($('#canvases').css('left'));
			self.true_y = self.y - parseInt($('#canvases').css('top'));

			
			// if left mouse button down AND the mouse moves
			// pan the Google map canvas
			if(self.left_button_down && !self.map_dragging && !self.option1_down){
				// $('#info').html('1')
				if((Math.abs(self.last_map_x - self.x) > 4) || (Math.abs(self.last_map_y - self.y) > 4)){
					self.add_point_on_up = false;
					self.map_dragging = true;
				}
			}
			 
			if(self.point_selected != null){
				self.movePoint(self.point_selected);
			} else if(self.left_button_down && self.map_dragging && !self.option1_down){
				var x_diff = self.last_map_x - self.x;
				var y_diff = self.last_map_y - self.y;
				
				//self.direction = Math.atan2(y_diff, x_diff) / Math.PI * 180;
				if((Math.abs(x_diff) > 2) || (Math.abs(y_diff) > 2)){
					self.last_map_x = self.x;
					self.last_map_y = self.y;

					self.moveCanvas(x_diff, y_diff);

					self.map.panBy(x_diff, y_diff);

					if(self.building_segment){
						//self.movePoints(x_diff, y_diff);
					}
				}
			// } else if(self.start_box_draw){
			// 	self.drawBox(true);
			// } else if(self.box_selected){
			// 	self.movePointsInBox();
			} else if(self.building_segment){
				self.nearPointOrLine();

				if(self.spring_to_point != null){
					self.redrawSegments({spring_to_point: self.spring_to_point});
				} else {
					self.redrawSegments();
				}
			}
		});
		
		// keeps right-click menu from appearing
		$(self.mouse_event_canvas).bind("contextmenu", function(e) {
			return false;
		});
		
		// keydown event does not need a canvas - it uses document
		// 46 - delete, option2_key - ctrl, option1_key - alt
		$(document).keydown(function(e){
			// moved here to keep from checking every time the mouse moves
			self.nearPointOrLine();

			if(e.which === 190) {
				if(self.points_hidden){
					self.points_hidden = false;
					self.redrawSegments();
				} else {
					self.points_hidden = true;
					self.redrawSegments();
				}

			// Tab hides the geocoded points
			// FIX when turned back on, the points positions are off
			} else if(e.which === 9) {
				e.preventDefault();

				if(self.geocodes_hidden){
					$('#g_canvas').css('visibility','visible');
					self.geocodes_hidden = false;
					self.plotGeocodes();
				} else {
					$('#g_canvas').css('visibility','hidden');
					self.geocodes_hidden = true;
					self.plotGeocodes();
				}

			// Caps hides the map
			} else if(e.which === 20) {
				if(self.map_hidden){
					$('#map_canvas').css('visibility','visible');
					self.map_hidden = false;
				} else {
					$('#map_canvas').css('visibility','hidden');
					self.map_hidden = true;
				}

			// ~ hides the lines
			} else if(e.which === 192) {
				if(self.lines_hidden){
					$('#a_canvas, #b_canvas, #c_canvas, #d_canvas, #e_canvas, #f_canvas').css('visibility','visible');
					self.lines_hidden = false;
				} else {
					$('#a_canvas, #b_canvas, #c_canvas, #d_canvas, #e_canvas, #f_canvas').css('visibility','hidden');
					self.lines_hidden = true;
				}

			// CTRL + Y down
			} else if(e.which === 89) {
				if(self.option1_down){
					self.stepForward();
				}

			// CTRL + Z down
			} else if(e.which === 90) {
				if(self.option1_down){
					self.stepBack();
				}


			} else if(e.which === 46) {
				if(self.segment_selected != null){
					self.deleteSegment();
				} else if(self.box_active){
					self.deletePointsInBox();
				} else if(self.point_selected){
					self.deletePoint();
				}
			} else if((e.which >= 37) && (e.which <= 40)){
				if(self.segment_selected != null){
					e.preventDefault();
					self.nudge(self.getPointsArrayFromSegment(), e.which);
				} else if(self.point_selected != null){
					e.preventDefault();
					self.nudge(self.point_selected, e.which);
				}

			// CTRL
			} else if(e.which === self.option1_key) {
				$(".ctrl").addClass('on');

				self.option1_down = true;

			// ALT
			} else if(e.which === self.option2_key) {
				$(".alt").addClass('on');

				self.option2_down = true;

			// Shift
			} else if(e.which === self.select_key) {
				$(".shift").addClass('on');

				self.select_down = true;
			}
		});

		// keyup event does not need a canvas - it uses document
		// option2_key - ctrl, option1_key - alt
		$(document).keyup(function(e){
			if(e.which === self.option1_key) {
				$(".ctrl").removeClass('on');
				self.option1_down = false;
			} else if(e.which === self.option2_key) {
				$(".alt").removeClass('on');
				self.option2_down = false;
			} else if(e.which === self.select_key) {
				$(".shift").removeClass('on');
				self.select_down = false;
			}
		});

		// set up listeners for inputs

		$('#left_input #left').bind('keypress', function(e) {
			if ((e.which && e.which == 13) || (e.keyCode && e.keyCode == 13)) {
				// console.log(self.o.territories[$('#left_input #left').val()]);
				if(!self.o.territories[$('#left_input #left').val()]){
					var num = $('#left_input #left').val();

					var html = '<a href="#" onclick="tm.displayTerritory(\'terr_' + num + '\')">' + num + '</a>';

					$('#territory_list').append(html);
					$('#left_input').css('display','none');
					self.saveTerritory('left', $('#left_input #left').val());
					$("#left_input #left, #territory_number").hide();
					self.redrawSegments({highlight: 'clear'});
				}
				return false;
			}
		});
		
		// listen for map movement or zoom via 'bounds_changed'
		google.maps.event.addListener(self.map, 'bounds_changed', function() {
			self.mapMoved();
		});

		self.setSaveOnUnload();
	},

	// TODO: set so that it saves a second version, not overwriting original
	setSaveOnUnload : function(){
		var self = this;

		$(window).unload(function(){
			if(self.save_on_unload){
				self.saveSegments();
			}
		});
	},

	getPointsNotToMove : function(){
		var self = this;

		$.each(self.out_territories, function(k, v){
			if(self.o.territories[v]){
				$.each(self.o.territories[v], function(k2, v2){
					if(v2){
						self.immovable_segments[v2] = 1;
						$.each(self.o.segments[v2].points, function(k3, v3){
							self.immovable_points[v3] = 1;
						});
					}
				});
			}
		});
	},

	leftButtonDown : function(){

		var self = this;
		self.left_button_down = true;
		self.point_selected = null;
		self.ready_to_start_segment_on_point = null;
		self.ready_to_delete_point = null;
		self.ready_to_nudge_point = null;

		// clean up highlighted segment if exists
		if(self.segment_selected != null){
			self.segment_selected = null;
			self.redrawSegments();
		}
		
		// if box is active - select or remove
		if(!self.build_mode){
			if(self.select_down){
				// first make sure the segments are okay
				self.checkSegments();

				$("#territory_exists").hide();
				$("#left_input #left, #territory_number").hide();

				self.selected_polygon = self.findPolygon();

				var territory_exists = self.doesTerritoryExist();

				if(territory_exists){
					$("#territory_exists").html("Territory " + territory_exists).show();
				} else {
					$("#left_input #left, #territory_number").show();
					$("#left_input #left").focus();
				}
			}
			self.last_map_x = self.x;
			self.last_map_y = self.y;
		} else {
			if(self.box_active){
				if(self.cursorInBox){
					self.box_selected = true;
				} else {
					self.removing_box = true;
				}
			// if segment not being built
			} else if(!self.building_segment){
				// else if near a point (takes precedence over line)
				// 1. if option 1 (add) - start new segment from point
				// 2. if option 2 (remove) - remove point
				// 3. if select - get point to nudge
				// 4. else move
				if(self.spring_to_point != null){
					if(self.option1_down){
						self.ready_to_start_segment_on_point = self.spring_to_point;
					} else if(self.option2_down){
						self.ready_to_delete_point = self.spring_to_point;
					/*
					} else if(self.select_down){
						self.ready_to_nudge_point = q;
					*/
					} else {
						self.point_selected = self.spring_to_point;
						self.spring_to_point = null;
						self.redrawSegments({ draw_other_segments: true });
					}
				// else if near a line
				} else if(self.on_line != null){
					if(self.select_down){
						// console.log('On line: '+self.on_line.segment)
						self.segment_selected = self.on_line.segment;
						self.redrawSegments();
					} else {
						self.addPoint( { segment: self.on_line.segment, location: self.on_line.after, on_line: true } );
						self.on_line = null;
						self.redrawSegments();
					}

				/*
				} else if(q = self.cursorNearLine()){
					if(self.option1_down){
						q = self.addPoint(q); // get point id
						self.startSegment(q);
					} else if(self.option2_down){
						self.deleteLine(q);
					} else if(self.select_down){
						self.segment_selected = q;
					} else {
						self.addPoint(q);
					}
				*/
				// everything else
				} else {
					// if option 1 (add)
					// 1. if building, add point
					// 2. else start segment, start building segment
					if(self.option1_down && self.select_down){
						self.start_segment = true;

					// if shift down display info
					} else if(self.select_down){
						// first make sure the segments are okay
						self.checkSegments();
						
						$("#territory_exists").hide();
						$("#left_input #left, #territory_number").hide();

						self.selected_polygon = self.findPolygon();

						var territory_exists = self.doesTerritoryExist();

						if(territory_exists){
							$("#territory_exists").html("Territory " + territory_exists).show();
						} else {
							$("#left_input #left, #territory_number").show();
							$("#left_input #left").focus();
						}

					// else start map dragging
					}
					self.last_map_x = self.x;
					self.last_map_y = self.y;
				}
			// if building segment
			} else {
				// if user clicks the line create a point and finish the segment
				if(!self.nearPointOrLine() && self.on_line !== null){
					self.addPoint( { segment: self.on_line.segment, location: self.on_line.after, on_line: true } );
					self.on_line = null;
					self.nearPointOrLine();
					self.addPoint( { segment: self.which_segment, point: self.spring_to_point, divide: true, territory_outline_check: true } );
					self.spring_to_point = null;
					self.which_segment = null;
					self.building_segment = false;
					self.redrawSegments();

					// self.nearPointOrLine();
					// self.redrawSegments({spring_to_point: self.spring_to_point});
				} else {
					if(self.option2_down){
						//self.cancel_building_segment_on_up = true;
						self.cancel_building_segment_on_up = false;
						self.which_segment = null;
						self.point_selected = null;
						self.building_segment = false;
						self.redrawSegments();
					}
					// NEARPOINT ONLY IN MOUSEMOVE
					//if(self.nearPoint()){

					//}
					self.add_point_on_up = true;
				}
				self.last_map_x = self.x;
				self.last_map_y = self.y;
			}
		}
	},

	middleButtonDown : function(){
		// if right click
		// 1. if box active, if not in box, remove the box
		// 2. start drawing
	},

	rightButtonDown : function(){
		var self = this;
		/*
		// first deselect any selections
		if(self.point_selected){
			self.point_selected = null;
		}
		if(self.which_segment){
			self.which_segment = null;
		}
		
		if(self.box_active){
			if(!self.cursorInBox){
				self.removeBox();
			}
		} else {
			self.whichSelect();
		}
		*/
	},
	
	leftButtonUp : function(){
		var self = this;
		self.box_selected = false;
		self.left_button_down = false;
		self.point_selected = null;
		self.map_dragging = false;
		
		/*
		if(self.removing_box){
			self.removeBox();
			self.removing_box = false;
		} else 
		*/
		if(self.start_segment){
			self.building_segment = true;
			self.start_segment = false;
			self.startSegment();
		} else if(self.ready_to_start_segment_on_point != null){
			self.building_segment = true;
			self.start_segment = false;
			self.startSegment( { point: self.ready_to_start_segment_on_point, divide: true } );
			self.ready_to_start_segment_on_point = null;
		} else if(self.ready_to_delete_point != null){
			self.deletePoint( { point: self.ready_to_delete_point } );
			self.ready_to_delete_point = null;
		/*
		} else if(self.ready_to_nudge_point){
			self.nudge_point = self.ready_to_nudge_point;
			self.ready_to_nudge_point = null;
		} else if(self.point_selected){
		*/
		} else if(self.building_segment){
			/*
			if(self.cancel_building_segment_on_up){
				self.cancel_building_segment_on_up = false;
				self.building_segment = false;
				self.redrawSegments();
			} else*/
			// snaps to point
			if(self.spring_to_point != null){
				self.addPoint( { segment: self.which_segment, point: self.spring_to_point, divide: true, territory_outline_check: true } );
				self.spring_to_point = null;
				self.which_segment = null;
				self.building_segment = false;
				self.redrawSegments();
			} else if(self.add_point_on_up){
				self.addPoint( { segment: self.which_segment } );
			}
		}
		// post work
		if(self.point_selected){
			self.point_selected = null;
		}
	},

	middleButtonUp : function(self){
		// if right click
		// 1. if box active, if not in box, remove the box
		// 2. start drawing
	},

	rightButtonUp : function(){
		var self = this;
		self.right_button_down = false;
		/*
		if(self.start_box_draw){
			self.drawBox(false);
		} else if(self.building_segment){
			if(self.add_point_on_up){
				self.addPoint(self.which_segment);
			}
		}
		*/
	},

	hookScrollEvent : function(){
		var self = this;
		var element = document.getElementById(self.mouse_event_canvas.replace('#',''));
		if(element.addEventListener) {
			element.addEventListener('DOMMouseScroll', self.mouseWheelScroll, false);
			element.addEventListener('mousewheel', self.mouseWheelScroll, false);
		} else if(element.attachEvent) {
			element.attachEvent("onmousewheel", self.mouseWheelScroll);
		}
	},

	// activated when mouse wheel scrolls
	// zooms map in or out depending on direction
	mouseWheelScroll : function(e){
		e = e ? e : window.event;
		var self = tm;
		var delta = e.detail ? e.detail * -1 : e.wheelDelta / 40;
		var	zoom = self.map.getZoom();
		
		if(delta > 0){
			zoom++;
		} else if(delta < 0){
			zoom--;
		}
		
		if(zoom < 0){
			zoom = 0;
		} else if(zoom > 20){
			zoom = 20;
		}

		$('.zoom').addClass('on').html("Zoom: "+zoom);
		timeout = setTimeout(function(){
			$('.zoom').removeClass('on');
		}, 700);

		$.each([self.l_c[8], self.l_c[9], self.l_c[10], self.l_c[11], self.l_c[12], self.l_c[13]], function(k, v){
			v.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
		});		
		
		self.map.setZoom(zoom);

		self.cancelEvent(e);

		self.nearPointOrLine();

		return false;
	},

	cancelEvent : function(e){
		e = e ? e : window.event;
		if(e.stopPropagation){
			e.stopPropagation();
		}
		if(e.preventDefault){
			e.preventDefault();
		}
		e.cancelBubble = true;
		e.cancel = true;
		e.returnValue = false;
		return false;
	},

	changeMode : function(mode){
		if(mode === 'view'){
			this.build_mode = false;
			$("#mode").addClass("view").removeClass("build");
		} else if(mode === 'build'){
			this.build_mode = true;
			$("#mode").addClass("build").removeClass("view");
		}
	},
		
	// actions when the bounds have changed
	mapMoved : function(){

		var self = this;
		var x_diff, y_diff, m, z, world_coordinate, pixel;

		var trigger = false;

		var canvases_top = parseInt($(self.canvases).css('top')),
			canvases_left = parseInt($(self.canvases).css('left'));

		// DOES NOT WORK AS EXPECTED
		if( (self.o.segment_bounds.x1 === null) ||
			(canvases_top > 0) ||
			(canvases_top < self.canvases_offset.y * -2) ||
			(canvases_left > 0) ||
			(canvases_left < self.canvases_offset.x * -2) ||
			(self.o.preferences.zoom != self.map.getZoom())
		){
			trigger = true;
		}
		
		// save map bounds
		self.o.map_bounds.x1 = self.map.getBounds().getSouthWest().lng(),
		self.o.map_bounds.y1 = self.map.getBounds().getNorthEast().lat(),
		self.o.map_bounds.x2 = self.map.getBounds().getNorthEast().lng(),
		self.o.map_bounds.y2 = self.map.getBounds().getSouthWest().lat();

		// get nw pixel
		m = new MercatorProjection;
		z = 1 << self.map.getZoom();
		world_coordinate = m.fromLatLngToPoint(new google.maps.LatLng(self.o.map_bounds.y1, self.o.map_bounds.x1));
		// console.log(world_coordinate)
		pixel = new google.maps.Point(world_coordinate.x * z, world_coordinate.y * z);
		self.o.nw_pixel.x = Math.floor(pixel.x);
		self.o.nw_pixel.y = Math.floor(pixel.y);

		// get differences
		x_diff = Math.abs(self.o.map_bounds.x1 - self.o.map_bounds.x2);
		y_diff = Math.abs(self.o.map_bounds.y1 - self.o.map_bounds.y2);
		
		// bounds for segment access more than visable canvas
		self.o.segment_bounds.x1 = self.o.map_bounds.x1 - (x_diff * self.map_overflow),
		self.o.segment_bounds.y1 = self.o.map_bounds.y1 + (y_diff * self.map_overflow),
		self.o.segment_bounds.x2 = self.o.map_bounds.x2 + (x_diff * self.map_overflow),
		self.o.segment_bounds.y2 = self.o.map_bounds.y2 - (y_diff * self.map_overflow);

		// save center and zoom
		self.o.preferences.center.x = (self.o.map_bounds.x1 + self.o.map_bounds.x2) / 2;
		self.o.preferences.center.y = (self.o.map_bounds.y1 + self.o.map_bounds.y2) / 2;
		self.o.preferences.zoom = self.map.getZoom();
			
		if(trigger){
			// reset the canvas
			self.resetCanvases();
			// plot geocodes of addresses
			self.plotGeocodes();
		}
	},

	// reset the canvases
	resetCanvases : function(){
		// get location
		var self = this,
			z = 1 << self.o.preferences.zoom,
			m = new MercatorProjection,
			nw_point = new google.maps.LatLng(self.o.map_bounds.y1, self.o.map_bounds.x1),
			world_coordinate = m.fromLatLngToPoint(nw_point),
			world_pixel_coordinate = new google.maps.Point(world_coordinate.x * z, world_coordinate.y * z),
			nw_x = Math.floor(world_pixel_coordinate.x),
			nw_y = Math.floor(world_pixel_coordinate.y);
	
		var point, point_world_coordinate, point_world_pixel_coordinate, new_x, new_y;

		// back to default location
		$('#canvases').css({'left': '-' + self.canvases_offset.x + 'px', 'top': '-' + self.canvases_offset.y + 'px'});

		$.each(self.o.points, function(index, value){
			if(value){
				point = new google.maps.LatLng(value.lat, value.lng),
				point_world_coordinate = m.fromLatLngToPoint(point),
				point_world_pixel_coordinate = new google.maps.Point(point_world_coordinate.x * z, point_world_coordinate.y * z),
				new_x = Math.floor(point_world_pixel_coordinate.x),
				new_y = Math.floor(point_world_pixel_coordinate.y);

				self.o.points[index].x = new_x - nw_x + self.canvases_offset.x;
				self.o.points[index].y = new_y - nw_y + self.canvases_offset.y;
			}
		});

		self.redrawSegments({ zoom_changed: true });
	},

	plotGeocodes : function(){
		var self = this;
		var c = self.l_c[6];

		c.clearRect(0, 0, this.extended_canvas_width, this.extended_canvas_height);

		if((self.geocodes != null) && (!self.geocodes_hidden)){
			var p, pwc, pwpc, p_x, p_y,
				z = 1 << self.o.preferences.zoom,
				m = new MercatorProjection,
				nw_point = new google.maps.LatLng(self.o.map_bounds.y1, self.o.map_bounds.x1),
				world_coordinate = m.fromLatLngToPoint(nw_point),
				world_pixel_coordinate = new google.maps.Point(world_coordinate.x * z, world_coordinate.y * z),
				nw_x = Math.floor(world_pixel_coordinate.x),
				nw_y = Math.floor(world_pixel_coordinate.y);			

			c.fillStyle = self.plot_geocode_color;

			c.beginPath();

			$.each(self.geocodes, function(k,v){
				//if((v[0] > self.o.segment_bounds.x1) && (v[0] < self.o.segment_bounds.x2)){
					p = new google.maps.LatLng(v[0], v[1]);
					pwc = m.fromLatLngToPoint(p);
					pwpc = new google.maps.Point(pwc.x * z, pwc.y * z);
					p_x = Math.floor(pwpc.x) - nw_x + self.canvases_offset.x;
					p_y = Math.floor(pwpc.y) - nw_y + self.canvases_offset.y;

					//c.moveTo(p_x, p_y);
					c.fillRect(p_x - 1, p_y - 1, 2, 2);
				//}

				// break out of loop if outside of bounds
				/*
				if(v[0] < self.o.segment_bounds.x2){
					c.stroke();
					return false;
				}*/
			});

			c.stroke();
		}
	},

	// function to draw segments
	// called each time the bounds change or a point changes
	drawCanvas : function(){
		var x, y,
			territories = [];
		
		// draw lines			
		for(var i = 0; i < self.o.segments.length; i++){
			if(self.o.segments[i] != null){
				// NEEDS WORK
				if(self.o.segments[i].territories.length){
					for(var j = 0; j < self.o.segments[i].territories.length; j++){
						if($.inArray(self.o.segments[i].territories[j], territories) > -1){
							
						}
					}
				}
				for(var j = 0; j < self.o.segments[i].points.length; j++){
					x = self.o.segments[i].points[j].x;
					y = self.o.segments[i].points[j].y;
					
					if(j === 0){
						self.segment_canvas.moveTo(x, y);
					} else {
						self.segment_canvas.lineTo(x, y);
					}
				}
			}
		}
		
		// fill polygons
		for(var i = 0; i < territories.length; i++){
			
		}
		
		return false;
	},
	
	// clear the canvas
	//
	// parameter	object	c (canvas)
	// return		this
	clearCanvas : function(c){
		c.clearRect(0, 0, this.extended_canvas_width, this.extended_canvas_height);
		return this;
	},
	
	// load semgents when loaded or map moves
	// get map coordinate boundaries (x1, y1, x2, y2) and load segments into set
	//
	// parameter	object	bounds 
	loadSegments : function(bounds){
		
	},
	
	// parses string using delimiter and seperator specified
	// the delimiter destinguishes seperate locations
	// the seperator splits the latitude and longitude
	//
	// parameter	string	s
	// parameter	string	del
	// parameter	string	sep
	// return		array	a
	parseSegmentString : function(s, del, sep){
		var a = [],
			delimiter = del || ';',
			seperator = sep || ',',
			split_string = s.split(delimeter),
			arr_parts;
		
		for(var x = 0; x < split_string.length; x++){
			if(split_string[x] && split_string[x] !== 'undefined'){
				arr_parts = split_string[x].split(seperator);
				a[x] = [parseFloat(arr_parts[0]), parseFloat(arr_parts[1])];
			}
		}
		return a;
	},
	
	// takes list of polygon arrays object and returns array of segments
	// NEEDS TO BE EXAMINED
	constructSegments : function(a){
		var polygon_segments = [],
			temp_a;
		
		for(var i = 0; i < this.set.segments.length; i++){
			temp_a = parsePolygonString(a[i]);
			
			for(var j = 0; j < temp_a.length; j++){
				segments[segments.length] = new Array(temp_a[j][0], temp_a[j][1])
			}
		}
		
		return segments;
	},
	
	// start segment
	// WORK ON THIS!
	startSegment : function(obj){
		var self = this;

		obj = obj || {};
		
		var point_clicked = obj.point,
			count_point_times = 0,
			which_segment = null,
			build_new_segment = true,
			last_point_in_segment,
			on_end = false;

		// point passed as a param
		if(point_clicked != undefined){
			// determine if there should be a new segment
			$.each(self.o.segments, function(segment_index, segment_value){
				if(segment_value != null){

					last_point_in_segment = this.points.length - 1;

					$.each(this.points, function(point_index, point_value){
						if(point_value === point_clicked){
							if(point_index === 0){
								which_segment = segment_index;
								self.draw_before_or_after = 'before';
								on_end = true;
							} else if(point_index === last_point_in_segment){
								which_segment = segment_index;
								self.draw_before_or_after = 'after';
								on_end = true;
							}
							count_point_times++;
						}
					});
				}
			});
			if((count_point_times === 1) && (on_end)){
				self.which_segment = which_segment;
				self.drawing_from_point = point_clicked;
			} else {
				self.draw_before_or_after = 'after';
				self.which_segment = this.o.segments.length;
				this.o.segments[self.which_segment] = new Segment(); //$.extend(true, {}, self.segment);
				self.addPoint( { point: point_clicked, segment: self.which_segment, divide: obj.divide } );
			}

		// no point provided in params
		} else {
			// CHECK!
			self.which_segment = $.inArray(null, this.o.segments) > -1 ? $.inArray(null, this.o.segments) : this.o.segments.length;
			this.o.segments[self.which_segment] = new Segment(); //$.extend(true, {}, self.segment);
			self.draw_before_or_after = 'after';
			self.addPoint({ segment: self.which_segment });
		}
	},

	// adds new point to line or in empty space
	//
	// parameter	number		segment (segment - if available)
	// parameter	number		point (point - if available)
	// parameter	number		location (location - if available: number)
	addPoint : function(obj){
		var self = this;

		var obj = obj || {},
			segment = obj.segment,
			point = obj.point,
			location = obj.location;
		
		// if no point is given, a point is added to array
		
		// WORK ON THIS
		//point = changePoint({ point: point, where: self.draw_before_or_after, location: location, });
		if(point == undefined){
			point = self.o.points.length;
			self.o.points[point] = {};
			self.o.points[point].x = self.x - parseInt($(self.canvases).css('left'));
			self.o.points[point].y = self.y - parseInt($(self.canvases).css('top'));
			self.o.points[point].lng = self.getLatLngFromXYCursor().x;
			self.o.points[point].lat = self.getLatLngFromXYCursor().y;
			// indexing - redundant information and more maintenance
			// but will dramatically improve speed when size increases
			self.o.points[point].i = [];
		}

		// adds point in current segment
		if(location != undefined){
			self.o.segments[segment].points.splice(location, 0, point);
			self.o.points[point].i.push(segment);
			self.point_selected = point;
		} else {
			if(self.draw_before_or_after === 'after'){
				self.o.points[point].i.push(segment);
				self.o.segments[segment].points.push(point);
			} else if(self.draw_before_or_after === 'before'){
				self.o.points[point].i.unshift(segment);
				self.o.segments[segment].points.unshift(point);
			}
		}

		if(self.draw_before_or_after === 'before'){
			self.drawing_from_point = self.o.segments[segment].points[0];
		} else {
			self.drawing_from_point = point;
		}

		self.step();
		
		// remove any highlights
		if(!obj.on_line){
			self.redrawSegments({ highlight: 'clear' });
			self.hideTerritoryInputs();
		}

		// divide or combine segments
		if(obj.divide){
			// return is original segment
			new_segment_object = self.reapportionSegments({ segment: obj.segment, point: obj.point });
		}

		// possibly construct territory
		if(obj.territory_outline_check){
			self.constructTerritories({ segment: new_segment_object.segment, point: new_segment_object.point });
		}

		return point;
	},

	// divides or connects segments
	// invoked only after addPoint() when point springs to existing point
	reapportionSegments : function(obj){
		var self = this;
		obj = obj || {};

		var point_segment_index = self.o.points[obj.point].i,
			splice_point_segment_index,
			other_segment,
			this_segment, that_segment,
			these_points, those_points,
			left_segment, right_segment,
			these_points, right_points,
			return_segment,
			point_index,
			new_segment1, new_segment2;
		

		// check the index for the number of points
		// if two points the segment is examined
		// 1) segment connected to 2) segment connecting
		if(point_segment_index.length === 2){
			// store other segment
			if(obj.segment === point_segment_index[0]){
				splice_point_segment_index = 0;
				other_segment = point_segment_index[1];
			} else {
				splice_point_segment_index = 1;
				other_segment = point_segment_index[0];
			}
			// store 'this' and 'that' segments
			this_segment = self.o.segments[obj.segment];
			that_segment = self.o.segments[other_segment];
			these_points = this_segment.points;
			those_points = that_segment.points;

			// connecting two segments OR working with one segment
			// connect if point is in one place on an end
			// - merges current segment into one connected to
			if((those_points[0] === obj.point) || (those_points[those_points.length - 1] === obj.point)) {
				// the same segment
				if(other_segment === obj.segment){
					// if start and end are the same do nothing
					if(those_points[0] === those_points[those_points.length - 1]){
						return {
							segment : obj.segment,
							point : obj.point
						};

					// connected somewhere in the middle
					} else {
						// make new segments
						// TRY $.inArray(null, self.o.segments) > -1 ? $.inArray(null, self.o.segments) : 
						new_segment1 = self.o.segments.length;
						self.o.segments[new_segment1] = new Segment(); //$.extend(true, {}, self.segment);

						new_segment2 = self.o.segments.length;
						self.o.segments[new_segment2] = new Segment(); //$.extend(true, {}, self.segment);
						
						// which side to cut off						
						if(those_points[0] === obj.point){
							// find after index 0
							return_segment = new_segment1;
							// CAN'T GET $.INARRAY TO WORK SO...
							// point_index = $.inArray(obj.point, those_points, 1);
							// --------------------
							for(var c = 1; c < those_points.length; c++){
								if(those_points[c] === obj.point){
									point_index = c;
									break;
								}
							}
							// --------------------
						} else if(those_points[those_points.length - 1] === obj.point){
							// find first
							return_segment = new_segment2;
							point_index = $.inArray(obj.point, those_points);
						}
						left_segment = self.o.segments[other_segment].points.slice(0, point_index + 1);
						right_segment = self.o.segments[other_segment].points.slice(point_index, those_points.length);

						// erase old segment
						self.o.segments[obj.segment] = null;

						// fix index
						self.changePointIndex({ old_segment: obj.segment, new_segment: new_segment1, points: left_segment })
						self.changePointIndex({ old_segment: obj.segment, new_segment: new_segment2, points: right_segment })

						self.o.segments[new_segment1].points = left_segment;
						self.o.segments[new_segment2].points = right_segment;

						// CHECK
						return {
							segment : return_segment,
							point : obj.point
						};
					}
				} else {
					// at beginning
					if(those_points[0] === obj.point){
						if(these_points[0] === those_points[0]){
							these_points.shift();
							those_points.reverse();
						} else if(these_points[these_points.length - 1] === those_points[0]){
							those_points.shift();
							those_points.reverse();
							these_points.reverse();
						}

					// at end
					} else if(those_points[those_points.length - 1] === obj.point){
						if(these_points[0] === those_points[those_points.length - 1]){
							these_points.shift();
						} else if(these_points[these_points.length - 1] === those_points[those_points.length - 1]){
							these_points.reverse();
							these_points.shift();
						}
					}

					// merge these two segments
					$.merge(those_points, these_points);

					// remove segment
					self.o.segments[obj.segment] = null;

					// fix index
					self.changePointIndex({ old_segment: obj.segment, new_segment: other_segment, points: these_points })

					self.o.points[obj.point].i.splice(splice_point_segment_index,1);

					return {
						segment : other_segment,
						point : those_points[those_points.length - 1]
					};
				}

			// otherwise it's in the middle
			// - finishes current segment
			// - splits the segment it ends at
			} else {
				point_index = $.inArray(obj.point, self.o.segments[other_segment].points);

				// make two new segments that come from the 'other_segment'
				left_segment = self.o.segments[other_segment].points.slice(0, point_index + 1);
				right_segment = self.o.segments[other_segment].points.slice(point_index, self.o.segments[other_segment].points.length);

				// first check to see if 'other_segment' is closed AND has no other segments connected (2 points)
				// if so, just change the start and end to the connecting point
				if((self.o.segments[other_segment].points[0] === self.o.segments[other_segment].points[self.o.segments[other_segment].points.length - 1]) && self.o.points[self.o.segments[other_segment].points[0]].i.length === 2){
					// take out the extra point and then merge them
					left_segment.shift();

					// change the index
					// remove from the first and add to the other
					self.o.points[self.o.segments[other_segment].points[0]].i.shift();
					self.o.points[obj.point].i.push(other_segment);

					// change the segment itself now
					self.o.segments[other_segment].points = $.merge(right_segment,left_segment);

					return {
						segment : obj.segment,
						point : obj.point
					};
				} else {
					// get rid of the segment that was split
					self.o.segments[other_segment] = null;

					new_segment1 = self.o.segments.length;
					self.o.segments[new_segment1] = new Segment(); //$.extend(true, {}, self.segment);

					new_segment2 = self.o.segments.length;
					self.o.segments[new_segment2] = new Segment(); //$.extend(true, {}, self.segment);

					self.o.segments[new_segment1].points = left_segment;
					self.o.segments[new_segment2].points = right_segment;

					self.changePointIndex({ old_segment: other_segment, new_segment: new_segment1, points: left_segment });
					self.changePointIndex({ old_segment: other_segment, new_segment: new_segment2, points: right_segment });

					// check territories to replace segments
					// other_segment, new_segment1, new_segment2
					$.each(self.o.territories, function(k, v){
						if($.inArray(other_segment, v) > -1){
							// console.log(self.o.segments[other_segment].points[0], self.o.segments[other_segment].points[self.o.segments[other_segment].points.length - 1]);
							// console.log(self.o.segments[new_segment1].points[0], self.o.segments[new_segment1].points[self.o.segments[new_segment1].points.length - 1]);
							// console.log(self.o.segments[new_segment2].points[0], self.o.segments[new_segment2].points[self.o.segments[new_segment2].points.length - 1]);

							self.o.territories[k].splice($.inArray(other_segment, v), 1, new_segment1, new_segment2);
						}
					});
					
					return {
						segment : obj.segment,
						point : obj.point
					};
				}
			}

		// if it connects to a point with two or more segments listed in the index
		} else {
			return {
				segment : obj.segment,
				point : obj.point
			};
		}
	},

	combineSegments : function(segment1, segment2){
		var self = this,
			removed_point = null,
			these_points = self.o.segments[segment1].points,
			those_points = self.o.segments[segment2].points;

		// determine how to combine them
		if(these_points[0] === those_points[0]){
			removed_point = these_points.shift();
			those_points.reverse();
		} else if(these_points[these_points.length - 1] === those_points[0]){
			removed_point = those_points.shift();
			those_points.reverse();
			these_points.reverse();
		} else if(these_points[0] === those_points[those_points.length - 1]){
			removed_point = these_points.shift();
		} else if(these_points[these_points.length - 1] === those_points[those_points.length - 1]){
			removed_point = these_points.pop();
			these_points.reverse();
		}

		// merge these two segments
		$.merge(those_points, these_points);

		// remove segment
		self.o.segments[segment1] = null;

		// fix index
		self.changePointIndex({ old_segment: segment1, new_segment: segment2, points: these_points })
		splice_point_segment_index = $.inArray(segment1, self.o.points[removed_point].i);

		self.o.points[removed_point].i.splice(splice_point_segment_index,1);

		// now check the territories for segment1 and segment 2
		// just remove segment 1
		$.each(self.o.territories, function(k, v){
			if(($.inArray(segment1, v) > -1) && ($.inArray(segment2, v) > -1)){
				self.o.territories[k].splice($.inArray(segment1, v), 1);
			}
		});
	},

	// handles the constant changes to the point-segment index
	changePointIndex : function(obj){
		var self = this;
		
		obj = obj || {};

		var found_one;

		// check all the points in the array provided
		$.each(obj.points, function(point_index, point_value){
			found_one = false;

			// check each segment in the point index
			$.each(self.o.points[point_value].i, function(point_segment_index, point_segment_value){
				// only need to change one
				if((point_segment_value === obj.old_segment) && !found_one){
					self.o.points[point_value].i[point_segment_index] = obj.new_segment;
					found_one = true;
				}
			});

			// if it didn't find a match, it needs to be added
			if(!found_one){
				self.o.points[point_value].i.push(obj.new_segment);
			}
		});				
	},

	// move points when the canvas moves
	moveCanvas : function(x_diff, y_diff){
		var self = this;

		$(self.canvases).css('top', (parseInt($(self.canvases).css('top')) - y_diff));
		$(self.canvases).css('left', (parseInt($(self.canvases).css('left')) - x_diff));

		//self.drawLine();
	},

	// since this will redraw all territories, we need confirmation
	startCalculateTerritories : function(){
		var confirm_this = confirm("Are you sure you want to remap all territories?");

		if(confirm_this){
			this.calculateTerritories();
		}

		return false;
	},

	// this will redraw all the territories
	calculateTerritories : function(){
		var self = this,
			t = []; // holds points in each one
	},


	// does the territory exist in local JS?
	doesTerritoryExist : function(){
		var self = this,
			compare_1 = [],
			compare_2 = [],
			exists = false;

		$.each(self.o.territories, function(k, v){
			if(v.length){
				// clone the array
				compare_1 = v.slice(0);
			}
			if(self.selected_polygon.segments){
				compare_2 = self.selected_polygon.segments.slice(0);
			}

			if(compare_1.length && compare_2.length){
				compare_1.sort();
				compare_2.sort();
				if(compare_1.toString() == compare_2.toString()){
					exists = k;
					return false;
				}
			}
		});

		return exists;
	},

	// displays the territory when the link is clicked
	displayTerritory : function(t){
		// replace the prefix added
		var territory = t.replace('terr_','');

		// now highlight this territory
		this.redrawSegments({ highlight: { left: this.o.territories[territory] } })

		// prevents the link from following through
		return false;
	},

	// removes the territory from the list when lines changed
	removeTerritory : function(){

	},

	// draw line
	redrawSegments : function(obj){
		var self = this;

		var newStartTime = new Date().getTime();

		obj = obj || {};
		var spring_to_point = obj.spring_to_point || null,
			highlight = obj.highlight;

		var c = self.l_c[0],
			cp = self.l_c[1],
			ch_l = self.l_c[2],
			ch_r = self.l_c[3],
			c2 = self.l_c[4],
			c2p = self.l_c[7],
			c_highlight = self.l_c[5];

		var drawing_size = 4;

		var first, left, right;


		if(self.o.preferences.zoom < 9){
			drawing_size = 1;
		} else if(self.o.preferences.zoom < 12){
			drawing_size = 2;
		}

		c2.lineWidth = drawing_size * 1.5;
		c2.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
		c2.strokeStyle = self.segment_stroke_color;
		c2p.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);

		if((!self.which_segment && !self.point_selected) || obj.zoom_changed){
			c.lineWidth = drawing_size * 1.5;
			c.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
			cp.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
			ch_l.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
			ch_r.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
		}

		c.strokeStyle = self.segment_stroke_color;

		c.beginPath();
		c2.beginPath();
		c2p.beginPath();
		cp.beginPath();

		if(highlight){
			// clear out the highlighter regions
			if(highlight === 'clear'){
				ch_l.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
				ch_r.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
				self.highlight = null;
				self.selected_polygon = null;
				$("#left_input, #right_input").css("display","none");
				$("#left_input #left, #territory_number").hide();
				$("#territory_exists").hide();
			} else {
				// add highlighted regions to the list
				self.highlight = highlight;
				highlight = null;
			}
		}
		if(self.highlight){
			if(self.highlight.left){
				$("#left_input").css("display","block");
				ch_l.lineWidth = drawing_size * 1.5;
				ch_l.fillStyle = "rgba(50,50,200,.25)";
				ch_l.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
				ch_l.beginPath();
			} else {
				ch_l.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
			}
			if(self.highlight.right){
				$("#right_input").css("display","block");
				ch_r.lineWidth = drawing_size * 1.5;
				ch_r.fillStyle = "rgba(50,200,50,.25)";
				ch_r.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
				ch_r.beginPath();
			} else {
				ch_r.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
			}
		}
		
		if(self.which_segment && self.o.segments[self.which_segment] && !obj.zoom_changed){
			segment_value = self.o.segments[self.which_segment];
			if(segment_value !== null){
				var num_points = segment_value.points.length;
				var zero_point_value = segment_value.points[0];

				// go through each point
				$.each(segment_value.points, function(points_index, points_value){
					// first is moveto
					if(points_index === 0){
						c2.moveTo(self.o.points[points_value].x, self.o.points[points_value].y);
					// all others are lineto
					} else {
						c2.lineTo(self.o.points[points_value].x, self.o.points[points_value].y);
					}
					if((drawing_size > 1) && !self.points_hidden){
						cp.fillRect(self.o.points[points_value].x - (drawing_size / 2), self.o.points[points_value].y - (drawing_size / 2), drawing_size, drawing_size);
					}
				});

				c2.moveTo(self.o.points[self.drawing_from_point].x, self.o.points[self.drawing_from_point].y);

				

				if(spring_to_point !== null && spring_to_point !== undefined){
					c2.lineTo(self.o.points[spring_to_point].x, self.o.points[spring_to_point].y);
				} else {
					// !!! move parseInt and jQuery operation out??
					c2.lineTo(self.x - parseInt($(self.canvases).css('left')), self.y - parseInt($(self.canvases).css('top')));
				}
			}

		// self.segment_selected
		} else if(self.point_selected && !obj.zoom_changed){
			if(obj.draw_other_segments){
				c.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
				cp.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
				var temp_segments = [];
				
				if(self.point_selected){
					temp_segments = self.o.points[self.point_selected].i;
				}

				// go through each segment
				$.each(self.o.segments, function(segment_index, segment_value){
					if(segment_value !== null && ($.inArray(segment_index, temp_segments) === -1)){
						var num_points = this.points.length;
						var zero_point_value = this.points[0];

						// go through each point
						$.each(this.points, function(points_index, points_value){
							// first is moveto
							if(points_index === 0){
								c.moveTo(self.o.points[points_value].x, self.o.points[points_value].y);
							// all others are lineto
							} else {
								c.lineTo(self.o.points[points_value].x, self.o.points[points_value].y);
							}
							if((drawing_size > 1) && !self.points_hidden){
								cp.fillRect(self.o.points[points_value].x - (drawing_size / 2), self.o.points[points_value].y - (drawing_size / 2), drawing_size, drawing_size);
							}
						});
					}
				});
			}
			$.each(self.o.points[self.point_selected].i, function(segment_index, segment_value){

				segment_value2 = self.o.segments[segment_value];

				if(segment_value2 !== null){
					var num_points = segment_value2.points.length;
					var zero_point_value = segment_value2.points[0];

					// go through each point
					$.each(segment_value2.points, function(points_index, points_value){
						// first is moveto
						if(points_index === 0){
							c2.moveTo(self.o.points[points_value].x, self.o.points[points_value].y);
						// all others are lineto
						} else {
							c2.lineTo(self.o.points[points_value].x, self.o.points[points_value].y);
						}
						if((drawing_size > 1) && !self.points_hidden){
							c2p.fillRect(self.o.points[points_value].x - (drawing_size / 2), self.o.points[points_value].y - (drawing_size / 2), drawing_size, drawing_size);
						}
					});
				}
			});

		} else {
			if(!obj.no_segments){
				// if(self.lineIntersectsLine()){
				// 	c.strokeStyle = self.no_draw_segment_stroke_color;
				// } else {
				// 	c.strokeStyle = self.segment_stroke_color;
				// }
				
				var temp_segments = [];
				
				if(self.point_selected){
					temp_segments = self.o.points[self.point_selected].i;
				}

				// go through each segment
				$.each(self.o.segments, function(segment_index, segment_value){
					if(segment_value !== null && ($.inArray(segment_index, temp_segments) === -1)){
						var num_points = this.points.length;
						var zero_point_value = this.points[0];

						// go through each point
						$.each(this.points, function(points_index, points_value){
							// first is moveto
							if(points_index === 0){
								c.moveTo(self.o.points[points_value].x, self.o.points[points_value].y);
							// all others are lineto
							} else {
								c.lineTo(self.o.points[points_value].x, self.o.points[points_value].y);
							}
							if((drawing_size > 1) && !self.points_hidden){
								cp.fillRect(self.o.points[points_value].x - (drawing_size / 2), self.o.points[points_value].y - (drawing_size / 2), drawing_size, drawing_size);
							}
						});
					}
				});
			}
		}

		// for highlighting one segment for a specific purpose
		if(self.segment_selected != null){
			c_highlight.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
			c_highlight.lineWidth = drawing_size * 1.5;
			c_highlight.strokeStyle = self.no_draw_segment_stroke_color;
			c_highlight.beginPath();

			// go through each point
			$.each(self.o.segments[self.segment_selected].points, function(points_index, points_value){
				// first is moveto
				if(points_index === 0){
					c_highlight.moveTo(self.o.points[points_value].x, self.o.points[points_value].y);
				// all others are lineto
				} else {
					c_highlight.lineTo(self.o.points[points_value].x, self.o.points[points_value].y);
				}
			});
			c_highlight.stroke();
		} else {
			c_highlight.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
		}

		var h = '';

		// this is used to determine if territories overlap
		// this isn't fullproof and needs points in each territory
		self.highlight_overlaps = {};

		// PROBLEMS ARISE WHEN THE FILL IS DONE WHEN THE TERRITORY IS OUTSIDE, NOT INSIDE
		if(self.highlight){
			var found = false;

			// first count the addresses in right (which also creates an array of ids to compare to left)
			// this is not fullproof, because it depends on counting points, but the alternative is complex
			if(self.highlight.left){
				left = self.normalizeSegments(self.highlight.left);
				var addresses_in_left = self.totalAddressesInTerritory(left, 'left');
			}
			if(self.highlight.right){
				right = self.normalizeSegments(self.highlight.right);
				var addresses_in_right = self.totalAddressesInTerritory(right, 'right');
			}

			if(self.highlight.right && self.highlight.left && self.highlight_overlaps.left && self.highlight_overlaps.right){
				$.each(self.highlight_overlaps.left, function(k, v){
					if($.inArray(v, self.highlight_overlaps.right) > -1){
						if(self.highlight_overlaps.right.length > self.highlight_overlaps.left.length) {
							found = 'left';
						} else {
							found = 'right';
						}
					}
				});
			}
			if(self.highlight.left && found !== 'right'){
				// check the number of addresses in a territory
				// show input fields to add territories
				first = true;

				self.showTerritoryInputs({ segments: self.highlight.left, left_or_right: 'left', addresses: addresses_in_left });

				if(left){
					$.each(left, function(points_index, points_value){
						// first is moveto
						if(first){
							ch_l.moveTo(self.o.points[points_value].x, self.o.points[points_value].y);
							h += 'highlight ('+points_value+')';
							first = false;
						} else {
							ch_l.lineTo(self.o.points[points_value].x, self.o.points[points_value].y);
							h += ', '+points_value;
						}
					});
					ch_l.fill();
				}
			}
			if(self.highlight.right && found !== 'left'){
				first = true;

				if(right){
					// check the number of addresses in a territory
					// show input fields to add territories
					self.showTerritoryInputs({ segments: self.highlight.right, left_or_right: 'right', addresses: addresses_in_right });
					$.each(right, function(points_index, points_value){
						// first is moveto
						if(first){
							ch_r.moveTo(self.o.points[points_value].x, self.o.points[points_value].y);
							first = false;
						} else {
							ch_r.lineTo(self.o.points[points_value].x, self.o.points[points_value].y);
						}
					});
					ch_r.fill();
				}
			}
		}

		c.stroke();
		cp.stroke();
		c2.stroke();
		c2p.stroke();
		self.endTime = new Date().getTime();
		self.startTime = newStartTime;

		
	},

	// set the points in a territory in order
	// take the array of segments and returns an array of points in order
	normalizeSegments : function(segments_array){
		if(segments_array && segments_array.length){
			var self = this;

			var num_arrays = segments_array.length,
				segments_left = $.extend(true, [], segments_array),
				current_last,
				count,
				inner_count;

			return_array = $.extend(true, [], self.o.segments[segments_left[0]].points);
			return_array.shift();
			segments_left.shift();

			if(num_arrays > 1){
				current_last = return_array[return_array.length - 1];

				// temporary to prevent endless counting because of unknown bug
				// still hazy why this doesn't always work
				// REMOVE ONCE BUG IDENTIFIED
				var prevent_endless_counting = 0;

				while(segments_left.length > 0, prevent_endless_counting < segments_left.length * 10){
					for(count = 0; count < segments_left.length; count++){
						if(self.o.segments[segments_left[count]].points[0] === current_last){
							for(inner_count = 1; inner_count < self.o.segments[segments_left[count]].points.length; inner_count++){
								return_array.push(self.o.segments[segments_left[count]].points[inner_count]);
							}
							current_last = return_array[return_array.length - 1];
							segments_left.splice(count,1);
							break;
						} else if(self.o.segments[segments_left[count]].points[self.o.segments[segments_left[count]].points.length - 1] === current_last){
							for(inner_count = self.o.segments[segments_left[count]].points.length - 2; inner_count >= 0; inner_count--){
								return_array.push(self.o.segments[segments_left[count]].points[inner_count]);
							}
							current_last = return_array[return_array.length - 1];
							segments_left.splice(count,1);
							break;
						}
					}
					prevent_endless_counting += 1;
				}
			}

			return return_array;
		}
	},

	showTerritoryInputs : function(obj){
		var self = this;
		var $elem = $('#'+obj.left_or_right+'_input');
		var $label = $('#'+obj.left_or_right+'_addresses');
		
		$('#' + obj.left_or_right + '_input #' + obj.left_or_right).val('');

		if(obj.left_or_right === 'left'){
			if(self.new_left_territory === true){
				if($elem.css('display') == 'none'){
					$elem.css('display','block');
				}
			}
			$label.html(obj.addresses+' addresses');
			self.new_left_territory = false;
		} else if(obj.left_or_right === 'right'){
			if(self.new_right_territory === true){
				if($elem.css('display') == 'none'){
					$elem.css('display','block');
				}
			}
			$label.html(obj.addresses+' addresses');
			self.new_right_territory = false;
		}
	},

	hideTerritoryInputs : function(){
		$('#left_input').css('display','none');
		$('#right_input').css('display','none');
	},

	// draw line
	drawLine : function(){
		var self = this;
		var c = self.l_c[0];
		var cp = self.l_c[1];
		var seg = self.o.segments[self.which_segment].points;
		var seg_length = seg.length;

		c.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
		cp.clearRect(0, 0, self.extended_canvas_width, self.extended_canvas_height);
			
		c.beginPath();
		cp.beginPath();
		
		c.moveTo(self.o.points[seg[0]].x, self.o.points[seg[0]].y);
		cp.fillRect(self.o.points[seg[0]].x - 2, self.o.points[seg[0]].y - 2, 4, 4);

		for(var i = 1; i < seg_length; i++){
			c.lineTo(self.o.points[seg[i]].x, self.o.points[seg[i]].y);
			cp.fillRect(self.o.points[seg[i]].x - 2, self.o.points[seg[i]].y, 4, 4);
		}
		/*
		if( ((a[0][0] - 12) < x && (a[0][0] + 12) > x) && ((a[0][1] - 12) < y && (a[0][1] + 12) > y)) {
			c.lineTo(a[0][0],a[0][1]);
			snap = true;
		} else { */
			c.moveTo(self.o.points[self.drawing_from_point].x, self.o.points[self.drawing_from_point].y);
			c.lineTo(self.x - parseInt($(self.canvases).css('left')), self.y - parseInt($(self.canvases).css('top')));
		//}



		c.stroke();
		cp.stroke();		
	},

	// using lowest point, area is calculated by adding the triangle plus rectangle
	// extended to baseline going right and subtracting the triangle plus the rectangle
	// when going left - the result could be positive or negative depending on start point
	//
	// parameter	string	a
	// return		number	area
	polygonArea : function(a){
		var area = 0,
			min_y,
			triangle_area,
			rectangle_area,
			temp_area;
		
		// first find the lowest y point as a baseline
		for(var x = 0; x < a.length; x++){
			min_y = i === 0 ? a[i][1] : Math.min(min_y, a[i][1]);
		}
		
		for(var x = 0; x < a.length - 1; x++){
			triangle_area = Math.abs((a[i+1][0] - a[i][0]) * (a[i+1][1] - a[i][1]) * .5);
			rectangle_area = Math.abs((a[i+1][0] - a[i][0]) * (Math.min(a[i+1][1], a[i][1]) - min_y));
			
			temp_area = triangle_area + rectangle_area;
			
			if((a[i+1][0] - a[i][0]) < 0){
				temp_area *= -1;
			}
			area += temp_area;
		}
		return area;
	},
	
	/**
	 * {param} point_or_array - the point or an array of points to nudge
	 * {param} direction - the value of the key pressed for the arrows
	 */
	nudge : function(point_or_array, direction){
		var self = this;

		if(typeof point_or_array === object){
			$.each(point_or_array, function(points_array_index, points_array_value){
				self.nudge(points_array_value, direction);
			});

			self.redrawSegments();
		} else {
			switch(direction){
				// 37 - left, 38 - up, 39 - right, 40 - down
				case 37:
					self.o.points[point_or_array].x -= 1;
					break;
				case 38:
					self.o.points[point_or_array].y -= 1;
					break;
				case 39:
					self.o.points[point_or_array].x += 1;
					break;
				case 40:
					self.o.points[point_or_array].y += 1;
					break;
			}

			self.o.points[points_array_value].lng = self.getLatLngFromXY(self.o.points[points_array_value].x, self.o.points[points_array_value].y).x;
			self.o.points[points_array_value].lat = self.getLatLngFromXY(self.o.points[points_array_value].x, self.o.points[points_array_value].y).y;
		}
	},
	
	// start select to decide what to select
	// immediately calls drawBox, which cancels any selection if dragged enough
	whichSelect : function(){
		var q; // temp
		
		// NEARPOINT ONLY IN MOUSEMOVE
		if(q = this.nearPoint()){
			this.point_selected = q;
		} else if(q = this.cursorNearLine()){
			this.which_segment = q;
		}
		
		this.drawBox(true);
	},
	
	// draw box function
	//
	// parameter	boolean		draw (if false drawing will stop)
	// return		this
	drawBox : function(draw){
		var self = this;
		var box_x1, box_y1, box_x2, box_y2;
		var b = self.b_c;
		var q;
		
		// begin - if not started but draw is true
		if(!self.start_box_draw && draw){
			self.start_box_x = self.x;
			self.start_box_y = self.y;
			self.start_box_draw = true;
		}
		// draw
		if(self.start_box_draw){
			// if not active (showing) wait for mouse to move 5 pixels or more
			if(!self.box_active) {
				if(Math.abs(Math.floor(self.x - self.start_box_x)) > 5 && Math.abs(Math.floor(self.y - start_box_y)) > 5) {
					self.point_selected = null;
					self.which_segment = null;
					self.box_active = true;
				}
			// now draw the box
			} else {
				b.clearRect(0, 0, self.o.preferences.canvas_width, self.o.preferences.canvas_height);
				b.beginPath();
				if(self.x < self.start_box_x) {
					self.box_offset_x = self.x;
					box_x1 = self.x;
					box_x2 = self.start_box_x;
				}  else {
					self.box_offset_x = self.start_box_x;
					box_x1 = self.start_box_x;
					box_x2 = self.x;
				}
				if(self.y < self.start_box_y) {
					self.box_offset_y = self.y;
					box_y1 = self.y;
					box_y2 = self.start_box_y;
				}  else {
					self.box_offset_y = self.start_box_y;
					box_y1 = self.start_box_y;
					box_y2 = self.y;
				}
				self.box_w = Math.abs(box_x1 - box_x2);
				self.box_h = Math.abs(box_y1 - box_y2);
				b.fillRect(box_x1, box_y1, self.box_w, self.box_h);
				b.strokeRect(box_x1, box_y1, self.box_w, self.box_h);
				b.stroke();
			}
		}
		
		// stop and determine points in box - if draw is false
		if(!draw){
			self.start_box_x = self.start_box_y = null; 
			self.start_box_draw = false;
			
			// adds point location to inside_box
			for(var i = 0; i < self.o.segments.length; i++){
				if(self.o.segments[i] != null){
					for(var j = 0; j < self.o.segments[i].points.length; j++){
						q = self.o.segments[i].points[j];
						if((q[0] > self.box_offset_x && q[0] < (self.box_offset_x + self.box_x))
						&& (q[1] > self.box_offset_y && q[1] < (self.box_offset_y + self.box_y))) {
							self.inside_box[inside_box.length][0] = i;
							self.inside_box[inside_box.length][1] = j;
						}
					}
				}
			}
		}
		return this;
	},
	
	// remove box
	//
	// return		this
	removeBox : function(){
		self.b_c.clearRect(0, 0, self.o.preferences.canvas_width, self.o.preferences.canvas_height);
		self.start_box_x = self.start_box_y, box_w, box_h, box_offset_x, box_offset_y = null;
		self.start_box_draw = self.box_active = self.box_selected = false;
		return this;
	},
	
	// return		array	(points in the box)
	selectPointsInBox : function(){
		var a = new Array();
		
		return a;
	},
	
	// return		this
	movePointsInBox : function(){
		return this;
	},
	
	// return		this
	deletePointsInBox : function(){
		return this;
	},

	count_to_show : 0,
	
	// calls nearPoint and nearLine
	// return 		boolean		true if near either
	nearPointOrLine : function(){
		var self = this;

		if((self.count_to_show % 4) === 0){
			return(self.nearPoint() || self.nearLine());
		} else {
			return false;
		}
		self.count_to_show++;
		if(self.count_to_show > 4){
			self.count_to_show = 0;
		}
	},

	// returning null evaluates to false
	nearPoint : function(){
		var self = this;

		var i,
			point = null,
			point_proximity = 10,
			found = false;

		$.each(self.o.points, function(index, value){
			if(value){
				if( (value.x - point_proximity) < self.true_x && (value.x + point_proximity) > self.true_x &&
					(value.y - point_proximity) < self.true_y && (value.y + point_proximity) > self.true_y ){
						point = index;
						found = true;
						return false;
				}
			}
		});

		if(found && !self.immovable_points[point]){
			self.spring_to_point = point;
			return true;
		} else {
			self.spring_to_point = null;
			return false;
		}
	},
	
	// returning null evaluates to false
	nearLine : function(){
		var self = this;
		var line = null;
		var found = false;
		var x1, y1, x2, y2;

		//pointLineLength(x,y,x1,y1,x2,y2)
		$.each(self.o.segments, function(segment_index, segment_value){
			if(segment_value != null){
				// segment structure:
				// [0 => [ 0 => 0, 1 => 1, 2 => 8, 3 => 4 ]]
				// [ [0, 1, 8, 4], [2, 3, 6, 7, 5] ]
				$.each(this.points, function(point_index, point_value){
					//
					// closed = true ? lines = points - 1 : lines = point
					//
					// for first point just store
					if(point_index === 0){
						x1 = self.o.points[point_value].x;
						y1 = self.o.points[point_value].y;
					// now 
					} else {
						x2 = self.o.points[point_value].x;
						y2 = self.o.points[point_value].y;

						if(self.pointLineLength(self.true_x, self.true_y, x1, y1, x2, y2) <= self.point_line_proximity){
							if(!self.immovable_segments[segment_index]){
								self.on_line = {
									before: (point_index - 1),
									after: point_index,
									segment: segment_index
								};
								found = true;
							}
							return false;
						} else if(!found){
							self.on_line = null;
						}

						x1 = x2;
						y1 = y2;
					}
				});
			}
		});
		return line;
	},

	findClosestPointToCursor : function(){
		var self = this,
			closest = null,
			distance = 1000000, // start high
			temp_distance;
		
		// go through all points to find the closest
		$.each(self.o.points, function(k, v){
			if(v){
				temp_distance = self.lineLength(self.true_x, self.true_y, v.x, v.y);

				if(temp_distance < distance){
					distance = temp_distance;
					closest = k;
				}
			}
		});

		return closest;
	},
	
	// returning null evaluates to false
	findPolygon : function(){
		var self = this,
			polygon = null,
			closest_point,
			segments,
			highlight = [],
			left, right;

		// clear the highlighted polygons
		self.redrawSegments({ highlight: 'clear' });

		// first find the closest point (which would definitely be in the polygon surrounding the cursor location)
		closest_point = self.findClosestPointToCursor();

		// go through each on the segments the point is in
		$.each(self.o.points[closest_point].i, function(k, v){

			// find the end point and construct the territory
			segments = self.constructTerritories({ point: self.o.segments[v].points[0], segment: v, only_get_outline: true});

			// build the points
			left = self.normalizeSegments(segments.left);

			// check to see if the cursor is inside
			if(left && self.isInside(left, self.getLatLngFromXYCursor().y, self.getLatLngFromXYCursor().x)){

				// add to the list
				highlight.push({'points': left, 'segments': segments.left});
			}
			right = self.normalizeSegments(segments.right);
			if(right && self.isInside(right, self.getLatLngFromXYCursor().y, self.getLatLngFromXYCursor().x)){
				highlight.push({'points': right, 'segments': segments.right});
			}
		});

		var points = null,
			selected = null;

		// if there where polygons with the point inside
		if(highlight.length){
			var least = 10000,
				temp;

			// go through the list and find the polygon with the least number of points
			// not fullproof, but for the time it will do
			// (replace with polygon area later)
			$.each(highlight, function(k, v){
				temp = self.totalAddressesInTerritory(v.points);

				if(temp < least){
					least = temp;
					selected = v.segments;
					points = v.points;
				}
			});

			// NOTE: redrawSegments 'highlight' takes the segments, but it could later take the points to keep it from running normalizeSegments again
			self.redrawSegments({ highlight: { left: selected, no_segments: true } });
		}

		return {
			"segments": selected,
			"points": points
		}
	},

	// NEW FUNCTION TO HANDLE EACH POINT
	/**
	 * param - p - point index
	 */
	newPoint : function(p){

	},

	// NEW FUNCTION TO HANDLE EACH POINTisi
	/**
	 * param - p - point index
	 */
	removePoint : function(p){

	},

	removeSegmentFromPoint : function(obj){
		var self = this,
			p = self.o.points[obj.point],
			s = obj.segment,
			count = p.i.length;

		for(; count >= 0; count--){
			if(p.i[count] === s){
				p.i.splice(count, 1);
			}
		}
	},

	deleteSegment : function(){
		var self = this,
			segment_points = self.o.segments[self.segment_selected].points,
			count = segment_points.length - 1, // delete inner points by starting at next to last
			first = segment_points[0],
			last = segment_points[count];

		// highlighting territories is problematic in this function
		self.highlight = null;

		// delete points

		// delete all inner points first, in reverse order
		for(; count >= 0; count--){
			// for first and last just remove the reference to the segment, not the point
			if(count === 0 || count === self.o.segments[self.segment_selected].points.length - 1){
				self.removeSegmentFromPoint({ point: segment_points[count], segment: self.segment_selected });

			// for all inner points, delete the entire point
			} else {
				self.deletePoint({ point: segment_points[count] });
			}
		}

		// if there are 2 segments in the points index, they need to be combined
		var fi = self.o.points[first].i;
		var li = self.o.points[last].i;
		var the_same = false;

		if((fi.length === 2) && (li.length === 2)){
			// if these are the same two segments
			if((fi[0] === li[0] && fi[1] === li[1]) || (fi[0] === li[1] && fi[1] === li[0])){
				the_same = true;
			}
		}

		if(fi.length === 2){
			if(fi[0] !== fi[1]){
				// console.log(fi[0], fi[1])
				self.combineSegments(fi[0], fi[1]);
			}
		}
		if(li.length === 2 && !the_same){
			if(li[0] !== li[1]){
				self.combineSegments(li[0], li[1]);
			}
		}

		// remove points as needed and segment
		$.each(self.o.segments[self.segment_selected].points, function(k, v){
			// if there's only one segment referenced and it referenced the segment to be deleted
			if((self.o.points[v].i.length === 1 && self.o.points[v].i[0] === self.segment_selected) || (self.o.points[v].i.length === 0)){
				self.o.points[v] = -1;
			}
		});
		// cleanup the last items
		// this is an array so only the last empty items can be removed
		for(var backtrack = self.o.points.length -1; backtrack >= 0; backtrack -= 1){
			if(self.o.points[backtrack] === -1){
				// remove the last item if empty
				self.o.points.pop();
			} else {
				break;
			}			
		}

		// TODO - this will select a territory that was combined
		// console.log(self.segment_selected)
		$.each(self.o.territories, function(k, v){
			if($.inArray(self.segment_selected, v) > -1){
				
				// remove the territory from the records
				self.removeTerritoryFromRecords(k);
				
				// this removes the old territories
				delete(self.o.territories[k]);

				// needs to save now (just in case)
				self.save_on_unload = true;
			}
		});

		self.o.segments[self.segment_selected] = null;
		self.segment_selected = null;

		self.step();

		self.redrawSegments();

		return this;
	},
	
	// return		this
	deletePoint : function(obj){
		var self = this;
		var count;
		obj = obj || {};

		// problems happen when territories outlined during this function
		self.highlight = null;

		// if segment_check
		// use point index to find all segments and remove reference to point
		$.each(self.o.points[obj.point].i, function(point_index_index, point_index_value){
			var which_segment = self.o.segments[point_index_value];
			for(var count = which_segment.points.length - 1; count >= 0; count--){
				if(which_segment.points[count] == obj.point){
					which_segment.points.splice(count, 1);
				}
			}
			if(which_segment.points.length == 1){
				// find the point that has this segment and remove it
				for(var inner_count = self.o.points[which_segment.points[0]].i.length - 1; inner_count >= 0; inner_count--){
					if(self.o.points[which_segment.points[0]].i[inner_count] == point_index_value){
						self.o.points[point_index_index] = -1;
					}
				}

				which_segment = null;
			}
		});

		self.o.points[obj.point] = -1;

		self.redrawSegments();

		return this;
	},
	
	// return		this
	movePoint : function(p){
		var self = this;

		self.o.points[p].x = self.true_x;
		self.o.points[p].y = self.true_y;
		self.o.points[p].lng = self.getLatLngFromXYCursor().x;
		self.o.points[p].lat = self.getLatLngFromXYCursor().y;

		self.redrawSegments();

		if(!self.moved_points[p]){
			self.moved_points[p] = 1;
		}

		return this;
	},

	// used when selecting empty space
	findClosestLeftSegment : function(obj){
		var self = this;

		self.isInside(obj.points, self.getLatLngFromXYCursor().x, self.getLatLngFromXYCursor().y);
	},

	// checks for and removes segments that cause problems with outlines
	// this function is meant to be temporary and should be handled when segments are made
	// the following segments are removed:
	// 1) segments with 1 point
	// 2) segments with the same point more than once
	checkSegments : function(){
		var self = this;

		var remove,
			remove_index = [];

		$.each(self.o.segments, function(segment_index, segment_value){
			remove = false;

			if(segment_value){
				// if less than 2 points, it's not a real segment
				if(segment_value.points.length < 2){
					remove = true;
					if(segment_value.points[0]){
						remove_index.push(segment_index);
					}
				}
				// if the segment is 2 points and the point is the same, it was created in error and will mess up the selection
				else if((segment_value.points.length === 2) && (segment_value.points[0] === segment_value.points[1])){
					remove = true;
					remove_index.push(segment_index);
				}
			}

			// null the segment
			if(remove){
				self.o.segments[segment_index] = null;
			}
		});
		// console.log(remove_index)
		$.each(self.o.points, function(point_index, point_value){
			if(point_value !== -1 && point_value.i.length){
				var c;

				for(c = point_value.i.length - 1; c >= 0; c--){
					if($.inArray(point_value.i[c], remove_index) > -1){
						// console.log(c, point_value.i[c], remove_index, $.inArray(point_value.i[c], remove_index) > -1)
						// console.log(self.o.points[point_index].i)
						self.o.points[point_index].i.splice(c, 1);
						// console.log(self.o.points[point_index].i)
					}
				}
			}
		});
	},

	constructTerritories : function(obj){
		var self = this;
		
		var count,
			end = false,
			found = false,
			opposite_point,
			find_point,
			original_point,
			left_segment,
			right_segment,
			return_object,
			point1, point2,
			x1, y1, x2, y2,
			angle1, angle2,
			closest_left,
			closest_right,
			max_steps = 25;

		self.new_left_territory = true;
		self.new_right_territory = true;

		obj = obj || {}; // segment, point

		// start with opposite end of obj.segment
		return_object = self.findOpposite(obj.segment, obj.point, true);

		// get the original angle
		original_point = point1 = obj.point;
		if(self.draw_before_or_after === 'before'){
			point2 = self.o.segments[obj.segment].points[1];
		} else if(self.draw_before_or_after === 'after'){
			point2 = self.o.segments[obj.segment].points[self.o.segments[obj.segment].points.length - 2];
		}

		// 0 to 90 to 180 from left to top to right
		// 0 to -90 to -180 from left to bottom to right
		angle1 = Math.atan2(self.o.points[point2].y - self.o.points[point1].y, self.o.points[point2].x - self.o.points[point1].x) * 180 / Math.PI;

		var current_point = obj.point;
		var current_segment = obj.segment;
		var left_segments = [];
		var right_segments = [];
		// arbitrary number higher than highest possible numbers: 540 and -540
		var closest_right;
		var closest_angle;
		var diff;
		var match;
		var angle_from_angle1;

		var original_angle1 = angle1 += 180;
		var original_point1 = point1;
		var original_current_point = current_point;
		var original_current_segment = current_segment;
		count = 0;

		if((self.o.segments[obj.segment].points[0] === self.o.segments[obj.segment].points[self.o.segments[obj.segment].points.length - 1]) && (self.o.segments[obj.segment].points[0] === obj.point)){
			left_segments = null;
			right_segments = [];
			right_segments[0] = obj.segment;
		} else {
			// right loop
			while(count < max_steps && !end && !found){
				//show('1',point1,current_segment,angle1);
				
				end = true;
				// find adjacent segments and determine nearest RIGHT angle
				$.each(self.o.segments, function(segment_index, segment_value){
					if(segment_value){
						match = false;
						// THIS DOESN'T COUNT THE SAME SEGMENT - ONLY OTHERS
						if(segment_index !== current_segment){
							if(point1 === self.o.segments[segment_index].points[0]){
								angle2 = Math.atan2(self.o.points[self.o.segments[segment_index].points[0]].y - self.o.points[self.o.segments[segment_index].points[1]].y, self.o.points[self.o.segments[segment_index].points[0]].x - self.o.points[self.o.segments[segment_index].points[1]].x) * 180 / Math.PI;
								match = true;
								end = false;
							} else if(point1 === self.o.segments[segment_index].points[self.o.segments[segment_index].points.length - 1]){
								angle2 = Math.atan2(self.o.points[self.o.segments[segment_index].points[self.o.segments[segment_index].points.length - 1]].y - self.o.points[self.o.segments[segment_index].points[self.o.segments[segment_index].points.length - 2]].y, self.o.points[self.o.segments[segment_index].points[self.o.segments[segment_index].points.length - 1]].x - self.o.points[self.o.segments[segment_index].points[self.o.segments[segment_index].points.length - 2]].x) * 180 / Math.PI;
								match = true;
								end = false;
							}
							
							if(match){
								angle_from_angle1 = (((angle1 - angle2 + 540) % 360) - 180);
								// right
								if(angle_from_angle1 < 0){
									angle_from_angle1 = 360 + angle_from_angle1;
								}
								if(!closest_angle){
									closest_right = segment_index;
									closest_angle = angle_from_angle1;
								} else if(angle_from_angle1 < closest_angle){
									closest_right = segment_index;
									closest_angle = angle_from_angle1;
								}
							}
						}
					}
				});
				// console.log('right ',count,' - ',closest_right,' - ',closest_angle)

				if(closest_right){
					right_segments.push(closest_right);

					var opposite_object = self.findOpposite(closest_right, point1);
					
					if(!opposite_object.nothing){

						//show('2',point1,opposite_object.place,opposite_object.point,closest_right,angle1,angle2);

						if(original_point === opposite_object.point){
							//right_segments.push(closest_right);
							found = true;
						}


						point1 = opposite_object.point;

						if(opposite_object.place === 0){
							point2 = self.o.segments[closest_right].points[1];
						} else {
							point2 = self.o.segments[closest_right].points[self.o.segments[closest_right].points.length - 2];
						}

						angle1 = (Math.atan2(self.o.points[point2].y - self.o.points[point1].y, self.o.points[point2].x - self.o.points[point1].x) * 180 / Math.PI) + 180;

						point1 = opposite_object.point;
						current_segment = closest_right;

						//show('3',count,point1,point2,current_segment,angle1);
						closest_angle = angle2 = angle_from_angle1 = null;

						if(end){
							right_segments = null;
						}
					}
				}

				count++;
			}


			angle1 = original_angle1;
			point1 = original_point1;
			current_point = original_current_point;
			current_segment = original_current_segment;
			count = 0;
			found = false;

			// left loop
			// do not do if 'only_get_outline' is set
				while(count < max_steps && !end && !found){
					//show('1',point1,current_segment,angle1);
					
					end = true;
					// find adjacent segments and determine nearest RIGHT angle
					$.each(self.o.segments, function(segment_index, segment_value){
						if(segment_value){
							match = false;
							// THIS DOESN'T COUNT THE SAME SEGMENT - ONLY OTHERS
							if(segment_index !== current_segment){
								if(point1 === self.o.segments[segment_index].points[0]){
									// console.log(self.o.points[self.o.segments[segment_index].points[1]], self.o.segments[segment_index].points[1], segment_index);
									angle2 = Math.atan2(self.o.points[self.o.segments[segment_index].points[0]].y - self.o.points[self.o.segments[segment_index].points[1]].y, self.o.points[self.o.segments[segment_index].points[0]].x - self.o.points[self.o.segments[segment_index].points[1]].x) * 180 / Math.PI;
									match = true;
									end = false;
								} else if(point1 === self.o.segments[segment_index].points[self.o.segments[segment_index].points.length - 1]){
									angle2 = Math.atan2(self.o.points[self.o.segments[segment_index].points[self.o.segments[segment_index].points.length - 1]].y - self.o.points[self.o.segments[segment_index].points[self.o.segments[segment_index].points.length - 2]].y, self.o.points[self.o.segments[segment_index].points[self.o.segments[segment_index].points.length - 1]].x - self.o.points[self.o.segments[segment_index].points[self.o.segments[segment_index].points.length - 2]].x) * 180 / Math.PI;
									match = true;
									end = false;
								}
								
								if(match){
									angle_from_angle1 = (((angle1 - angle2 + 540) % 360) - 180);
									// left
									if(angle_from_angle1 > 0){
										angle_from_angle1 = angle_from_angle1 - 360;
									}
									if(!closest_angle){
										closest_left = segment_index;
										closest_angle = angle_from_angle1;
									} else if(angle_from_angle1 > closest_angle){
										closest_left = segment_index;
										closest_angle = angle_from_angle1;
									}
								}
							}
						}
					});
					// console.log('left ',count,' - ',closest_left,' - ',closest_angle)
				
					if(closest_left){
						left_segments.push(closest_left);

						var opposite_object = self.findOpposite(closest_left, point1);

						if(!opposite_object.nothing){
							//show('2',point1,opposite_object.place,opposite_object.point,closest_right,angle1,angle2);

							if(original_point === opposite_object.point){
								//right_segments.push(closest_right);
								found = true;
							}

							point1 = opposite_object.point;

							if(opposite_object.place === 0){
								point2 = self.o.segments[closest_left].points[1];
							} else {
								point2 = self.o.segments[closest_left].points[self.o.segments[closest_left].points.length - 2];
							}

							angle1 = (Math.atan2(self.o.points[point2].y - self.o.points[point1].y, self.o.points[point2].x - self.o.points[point1].x) * 180 / Math.PI) + 180;

							point1 = opposite_object.point;
							current_segment = closest_left;

							//show('3',count,point1,point2,current_segment,angle1);
							closest_angle = angle2 = angle_from_angle1 = null;

							if(end){
								left_segments = null;
							}
						}
					}

					count++;
				}
		}

		if(((opposite_object && !opposite_object.nothing) || !opposite_object) && !obj.only_get_outline){
			self.redrawSegments({ highlight: { left: left_segments, right: right_segments } });
		}

		if(obj.only_get_outline){
			return { right: right_segments, left: left_segments }
		}
	},

	isInside : function(points, p_x, p_y){
		var self = this;
		var polySides = points.length,
			j = polySides - 1,
			odd = -1,
			i;

		for(i = 0; i < polySides; i++){
			if ((self.o.points[points[i]].lng < p_y && self.o.points[points[j]].lng >= p_y) || (self.o.points[points[j]].lng < p_y && self.o.points[points[i]].lng >= p_y)){
				if (self.o.points[points[i]].lat + (p_y - self.o.points[points[i]].lng) / (self.o.points[points[j]].lng - self.o.points[points[i]].lng) * (self.o.points[points[j]].lat - self.o.points[points[i]].lat) < p_x){
					odd *= -1;
				}
			}
			j = i;
		}

		return odd === 1 ? true : false;
	},

	// return boolean
	isAddressInTerritory : function(){

		return false;
	},

	totalAddressesInTerritory : function(points){
		var self = this,
			c = 0;

		$.each(self.geocodes, function(geocodes_key, geocodes_value){
			if(self.isInside(points, geocodes_value[0], geocodes_value[1])){
				c++;
			}
		});

		return c;
	},

	findOpposite : function(segment, point, building){
		var self = this;

		if(building){
			if(self.draw_before_or_after === 'before'){
				return {
					place: self.o.segments[segment].points.length - 1,
					point: self.o.segments[segment].points[self.o.segments[segment].points.length - 1]
				}
			} else if(self.draw_before_or_after === 'after'){
				return {
					place: 0,
					point: self.o.segments[segment].points[0]
				}
			} else {
				return {};
			}
		} else {
			if(segment){
				if(self.o.segments[segment].points[0] === point){
					return {
						place: self.o.segments[segment].points.length - 1,
						point: self.o.segments[segment].points[self.o.segments[segment].points.length - 1]
					}
				} else if(self.o.segments[segment].points[self.o.segments[segment].points.length - 1] === point){
					return {
						place: 0,
						point: self.o.segments[segment].points[0]
					}
				} else {
					return {};
				}
			} else {
				// this is returned when two open segments are connected, which means it connects to nothing, therefore, no opposite
				return { nothing: true };
			}
		}
	},

	// add a step - function is called with 'step'
	// is chainable (eg. step.deletePoint(p))
	step : function(){
		var self = this;

		self.steps.length = self.current_step + 1;

		self.steps.push($.extend(true, {}, self.o));

		if(self.steps.length > 8){
			self.steps.shift();
		}

		self.current_step = self.steps.length - 1;
		
		return this;
	},

	// undo step
	stepBack : function(){
		var self = this;

		self.current_step--;

		if(self.current_step < 1){
			self.current_step = 1;
		}

		self.o = self.steps[self.current_step];

		self.redrawSegments();
		self.mapMoved();
	},

	// redo step
	stepForward : function(){
		var self = this;

		self.current_step++;

		if(self.current_step >= self.steps.length - 1){
			self.current_step = self.steps.length - 1;
		}

		self.o = self.steps[self.current_step];

		self.redrawSegments();
		self.mapMoved();
	},
	
	// undo last 10 steps
	undo : function(){
		if(this.current_step >= this.steps.length){
			this.current_step >= this.steps.length;
		} else {
			this.current_step++;
		}
		displayChange();
		
		return this;
	},
	
	// redo last 10 steps
	redo : function(){
		if(this.current_step <= 0) {
			this.current_step = 0;
		} else {
			this.current_step--;
		}
		displayChange();
		
		return this;
	},
	
	// get the coords from the cursor location
	getLatLngFromXYCursor : function(){
		var self = this;
		var m = new MercatorProjection,
			z = 1 << self.map.getZoom(),
			lat_lng_cursor = m.fromPointToLatLng(new google.maps.Point((self.o.nw_pixel.x + self.x) / z, (self.o.nw_pixel.y + self.y) / z));

		return {
			x : (Math.round(lat_lng_cursor.lng() * 1000000) / 1000000),
			y : (Math.round(lat_lng_cursor.lat() * 1000000) / 1000000)
		}
	},
	
	// get the coords from the x or y value
	getLatLngFromXY : function(old_x, old_y){
		var self = this,
			obj = obj || {};
		var m = new MercatorProjection,
			z = 1 << self.map.getZoom()

		lat_lng = m.fromPointToLatLng(new google.maps.Point((self.o.nw_pixel.x + old_x) / z, (self.o.nw_pixel.y + old_y) / z));

		return {
			x : (Math.round(lat_lng.lng() * 1000000) / 1000000),
			y : (Math.round(lat_lng.lat() * 1000000) / 1000000)
		}
	},

	// change the canvas after undo or redo
	displayChange : function(){
		
	},
	
	// built-in message system
	message : function(s){
		if(s) {
			alert(s); // change to custom alert
		}
	},
	
	// ****** mathematical functions ******
	// convert area to square miles or kilometers
	// NEEDS WORK
	readableArea : function(area, latitude, unit){
		return area;
	},
	
	// parameters	number	x1, y1, x2, y2
	// return		number	(length of line)
	lineLength : function(x1, y1, x2, y2){
		return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
	},

	// if lines intersect
	lineIntersectsLine : function(){
		var self = this;

		var points = self.o.points,
			segments = self.o.segments,
			segment_length = self.o.segments.length;

		var a1 = {},
			a2 = {},
			b1 = {},
			b2 = {};

		// go through all lines
		for(var w = 0; w < segment_length; w++){
			if(segments[w] != null){
				for(var x = 0; x < segments[w].points.length - 1; x++){
					a1.x = points[segments[w].points[x]].x;
					a1.y = points[segments[w].points[x]].y;

					a2.x = points[segments[w].points[x + 1]].x;
					a2.y = points[segments[w].points[x + 1]].y;

					for(var y = 0; y < segment_length; y++){
						if(segments[y] != null){
							for(var z = 0; z < segments[y].points.length - 1; z++){
								b1.x = points[segments[y].points[z]].x;
								b1.y = points[segments[y].points[z]].y;

								b2.x = points[segments[y].points[z + 1]].x;
								b2.y = points[segments[y].points[z + 1]].y;

								if(self.intersectLineLine(a1, a2, b1, b2)){
									return true;
								}
							}
						}
					}
				}
			}
		}
		return false;
	},

	/*****
	*
	*   intersectLineLine
	*
	*****/
	intersectLineLine : function(a1, a2, b1, b2){
		var result;

		var ua_t = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x);
		var ub_t = (a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x);
		var u_b  = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);

		if ( u_b != 0 ) {
			var ua = ua_t / u_b;
			var ub = ub_t / u_b;

			if ( 0 < ua && ua < 1 && 0 < ub && ub < 1 ) {
				result = true;
				/*	a1.x + ua * (a2.x - a1.x), a1.y + ua * (a2.y - a1.y)  */
			} else {
				result = false;
			}
		} else {
			if ( ua_t == 0 || ub_t == 0 ) {
				result = false;
			} else {
				result = false;
			}
		}

		return result;
	},
	
	//+ Jonas Raoni Soares Silva
	//@ http://jsfromhell.com/math/dot-line-length [rev. #1]
	pointLineLength : function(x, y, x0, y0, x1, y1){
		var o = true;
		if(o && !(o = function(x, y, x0, y0, x1, y1){
			if(!(x1 - x0)) {
				return {
					x: x0,
					y: y
				};
			} else if(!(y1 - y0)) {
				return {
					x: x,
					y: y0
				};
			}
			var left,
				tg = -1 / ((y1 - y0) / (x1 - x0));
			return {
				x: left = (x1 * (x * tg - y + y0) + x0 * (x * - tg + y - y1)) / (tg * (x1 - x0) + y0 - y1),
				y: tg * left - tg * x + y
			};
		}(x, y, x0, y0, x1, y1), o.x >= Math.min(x0, x1) && o.x <= Math.max(x0, x1) && o.y >= Math.min(y0, y1) && o.y <= Math.max(y0, y1))){
			var l1 = this.lineLength(x, y, x0, y0),
				l2 = this.lineLength(x, y, x1, y1);
			return l1 > l2 ? l2 : l1;
		} else {
			var a = y0 - y1, b = x1 - x0, c = x0 * y1 - y0 * x1;
			return Math.abs(a * x + b * y + c) / Math.sqrt(a * a + b * b);
		}
	},
	
	// unknown author, unknown if functional
	pointInPolygon : function(poly, pt){
		for(var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
			((poly[i].y <= pt.y && pt.y < poly[j].y) || (poly[j].y <= pt.y && pt.y < poly[i].y))
			&& (pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)
			&& (c = !c);
		return c;
	},

	degreesToRadians : function(deg) {
		return deg * (Math.PI / 180);
	},
 
	radiansToDegrees : function(rad) {
		return rad / (Math.PI / 180);
	},

	// creates canvas structure
	setupCanvases : function(){
		var self = this,
			id,
			location = new google.maps.LatLng(self.o.preferences.center.y, self.o.preferences.center.x);

		// set extended canvas
		self.extended_canvas_width = (self.o.preferences.canvas_width * self.extended_canvas_size * self.overflow) + self.o.preferences.canvas_width;
		self.extended_canvas_height = (self.o.preferences.canvas_height * self.extended_canvas_size * self.overflow) + self.o.preferences.canvas_height;

		self.canvases_offset.x = (self.o.preferences.canvas_width * self.extended_canvas_size);
		self.canvases_offset.y = (self.o.preferences.canvas_height * self.extended_canvas_size);
		
		// setup Google map
		// must be called first: http://maps.google.com/maps/api/js?sensor=false
		$(self.canvas_wrapper).css({'width':self.o.preferences.canvas_width+'px','height':(self.o.preferences.canvas_height+12)+'px'}).append('<div id="'+self.map_canvas+'" style="width: '+self.o.preferences.canvas_width+'px; height: '+(self.o.preferences.canvas_height+12)+'px;"></div>');

		id = self.canvases.replace('#','');
		$(self.canvas_wrapper).append('<div id="'+id+'" style="top: -' + self.canvases_offset.y + 'px; left: -' +self.canvases_offset.x + 'px; width: ' + self.extended_canvas_width + 'px; height: ' + self.extended_canvas_height + 'px;"></div>');

		// FIX TO IMPORT
		self.map_options = {
			zoom : self.o.preferences.zoom,
			center : location,
			mapTypeId : google.maps.MapTypeId.ROADMAP,
			panControl : false,
			rotateControl : false,
			scaleControl : false,
			streetViewControl : false,
			zoomControl : false,
			draggable : false,
			mapTypeControl : false
		};
		
		self.map = new google.maps.Map(document.getElementById(self.map_canvas), self.map_options);
		self.projection = new MercatorProjection();
		
		// multicolored layers
		var i = 0;
		$.each(self.canvas_layers, function(){
			id = this.replace('#','');
			$(self.canvases).append('<canvas id="'+this+'" style="width: '+self.extended_canvas_width+'px; height: '+self.extended_canvas_height+'px;"></canvas>');
			self.l_c[i++] = self.setCanvas({ extended: true, id: this, stroke: self.segment_stroke_color, cap: self.segment_cap, fill: self.layer_fill_style });
		});
		
		// segments
		id = self.segment_canvas.replace('#','');
		$(self.canvases).append('<canvas id="'+id+'" style="width: '+self.extended_canvas_width+'px; height: '+self.extended_canvas_height+'px;"></canvas>');
		self.s_c = self.setCanvas({ extended: true, id: id, stroke: self.segment_stroke_color, width: self.segment_line_width, cap: self.segment_cap });
		
		// box
		id = self.box_canvas.replace('#','');
		$(self.canvases).append('<canvas id="'+id+'" style="width: '+self.extended_canvas_width+'px; height: '+self.extended_canvas_height+'px;"></canvas>');
		self.b_c = self.setCanvas({ extended: true, id: id, stroke: self.box_stroke_color, width: self.box_line_width, cap: self.line_cap, fill: self.box_fill_style });
		
		// mouse event
		id = self.mouse_event_canvas.replace('#','');
		$(self.canvas_wrapper).append('<canvas id="'+id+'" style="width: '+self.extended_canvas_width+'px; height: '+self.extended_canvas_height+'px;"></canvas>');
		self.me_c = self.setCanvas({ extended: false, id: id });
	},

	// creates a canvas
	// parameters	boolean	extended
	// parameters	string	id, stroke, fill, cap
	// parameters	number	width
	// return		object	(canvas)
	setCanvas : function(obj){
		var self = this;
		obj = obj || {};
		var c = document.getElementById(obj.id), gc;

		if(obj.extended){
			c.width = this.extended_canvas_width;
			c.height = this.extended_canvas_height;
		} else {
			c.width = self.o.preferences.canvas_width;
			c.height = self.o.preferences.canvas_height;
		}
		//$('#' + id).css({'top': '-' + (self.o.preferences.canvas_height * self.extended_canvas_size) + 'px', 'left': '-' + (self.o.preferences.canvas_width * self.extended_canvas_size) + 'px'});
		gc = c.getContext('2d');

		if(obj.fill) {
			gc.fillStyle = obj.fill;
		}
		if(obj.stroke){
			gc.strokeStyle = obj.stroke;
		}
		if(obj.width){
			gc.lineWidth = obj.width;
		}
		if(obj.cap){
			gc.lineCap = gc.lineJoin = obj.cap;
		}

		return gc;
	},

	saveLocation : function(){
		
	},

	deleteSegments : function(){
		var self = this;

		var conf = confirm("Are you sure you want to delete the segments?");
		if(conf){
			self.deleted = true;
			$.ajax({
				type: 'GET',
				url: 'delete_segments.php?delete=yes'
			});
		}
	},
	
	saveSegments : function(){
		var self = this;
		//$.post('save_segments.php', stringify(self.o), function(data){ alert(data); });
		var o_clone = $.extend(true, {}, self.o);
		var no_of_segments = 0,
			no_of_terr = 0,
			key;

		$.each(o_clone.points, function(k, v){
			if(o_clone.points[k].x && o_clone.points[k].y){
				delete o_clone.points[k].x;
				delete o_clone.points[k].y;
			}
		});

		$.each(self.o.segments, function(k, v){
			if(v){
				no_of_segments += 1;
			}
		});

		for (key in self.o.territories) {
			if(self.o.territories.hasOwnProperty(key)){
				no_of_terr += 1;
			}
		}

		var o = {};
		o.data = JSON.stringify(o_clone);

		$.ajax({
			type: 'POST',
			url: 'save_segments.php',
			data: {segments: o, no_of_segments: no_of_segments, no_of_terr: no_of_terr },
			dataType: 'html'
		}).done(function(data){
			alert(data);
		}).fail(function(data){
			alert("Failed to save - "+data);
		});

		// this updates the polygons of territories that had the points moved
		var already_updated = [];

		$.each(self.moved_points, function(k, v){
			$.each(self.o.points[k].i, function(k2, v2){
				$.each(self.o.territories, function(k3, v3){
					if($.inArray(v2, v3) > -1){
						// console.log(k3, already_updated, $.inArray(k3, already_updated))
						if($.inArray(k3, already_updated) === -1){
							already_updated.push(k3);

							self.removeTerritoryFromRecords(k3, function(){
								self.saveTerritoryToDatabase(k3, self.normalizeSegments(self.o.territories[k3]), already_updated.join(','));
							});
							// console.log(self.normalizeSegments(self.o.territories[k3]));
						}
					}
				});
			});
		});

		return false;
	},


	loadLocations : function(){

	},

	// future use
	parseGeocodes : function(data){
		/*
		$.each(data, function(key, val){
			console.log(val);
		});*/
	},
	
	// load preferences from JSON file
	loadPreferences : function(){
		var self = this;
		var loaded = false;

		try {
			$.ajax({
				url: 'get_json.php',
				dataType: 'json',
				success: function(data){
					var obj = {};
					//var parsed = $.parseJSON(data);

					$.each(data, function(key, val){
						obj[key] = val;
					})

					$.extend(true, self.o, obj);

					loaded = true;

					// initialize
					self.init();
				},
				error: function(){
					alert('error loading configuration');
				}
			})

		} catch(e){}

		return this;
	}
};

function Point2D(x,y){
	if(arguments.length>0){
		this.init(x,y);
	}
}
Point2D.prototype.init = function(x,y){
	this.x=x;
	this.y=y;
};

function MercatorProjection() {
	this.pixelOrigin_ = new google.maps.Point(128, 128);
	this.pixelsPerLonDegree_ = 256 / 360;
	this.pixelsPerLonRadian_ = 256 / (2 * Math.PI);
};
 function degreesToRadians(deg) {
	return deg * (Math.PI / 180);
};
function radiansToDegrees(rad) {
	return rad / (Math.PI / 180);
};
function bound(value, opt_min, opt_max) {
	if (opt_min != null) value = Math.max(value, opt_min);
	if (opt_max != null) value = Math.min(value, opt_max);
	return value;
};
MercatorProjection.prototype.fromLatLngToPoint = function(latLng, opt_point) {
	var point = opt_point || new google.maps.Point(0, 0);

	var origin = this.pixelOrigin_;
	point.x = origin.x + latLng.lng() * this.pixelsPerLonDegree_;
	var siny = bound(Math.sin(degreesToRadians(latLng.lat())), -0.9999, 0.9999);
	point.y = origin.y + 0.5 * Math.log((1 + siny) / (1 - siny)) * -this.pixelsPerLonRadian_;
	return point;
};
MercatorProjection.prototype.fromPointToLatLng = function(point) {
	var origin = this.pixelOrigin_;
	var lng = (point.x - origin.x) / this.pixelsPerLonDegree_;
	var latRadians = (point.y - origin.y) / -this.pixelsPerLonRadian_;
	var lat = radiansToDegrees(2 * Math.atan(Math.exp(latRadians)) - Math.PI / 2);
	return new google.maps.LatLng(lat, lng);
};

window.show = function(start){
	var h = '(' + start + ') ';
	for (var i = 1; i < arguments.length; i++){
		h += arguments[i] + ' :: ';
	}
}


// start
$(function(){
	tm.loadPreferences();
});
