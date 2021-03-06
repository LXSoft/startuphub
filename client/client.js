// All Tomorrow's Parties -- client

Meteor.subscribe("directory");
Meteor.subscribe("parties");

// Attending function
var attending = function(party)
{
	return (_.groupBy(party.rsvps, 'rsvp').yes || []).length;
};

///////////////////////////////////////////////////////////////////////////////
// Users

var displayName = function(user)
{
	if (user.profile && user.profile.name)
		return user.profile.name;
	return user.emails[0].address;
};

var contactEmail = function(user)
{
	if (user.emails && user.emails.length)
		return user.emails[0].address;
	if (user.services && user.services.facebook && user.services.facebook.email)
		return user.services.facebook.email;
	return null;
};

// If no party selected, select one.
Meteor.startup(function()
{
	Meteor.autorun(function()
	{
		if (!Session.get("Date"))
		{
			Session.set("Date", new Date().toDateString());
		}
		if (!Session.get("selected"))
		{
			var party = Parties.findOne();
			if (party) Session.set("selected", party._id);
		}
	});
});

///////////////////////////////////////////////////////////////////////////////
// Party details sidebar

Template.details.party = function()
{
	return Parties.findOne(Session.get("selected"));
};

Template.details.anyParties = function()
{
	return Parties.find().count() > 0;
};

Template.details.creatorName = function()
{
	var owner = Meteor.users.findOne(this.owner);
	if (owner._id === Meteor.userId()) return "me";
	return displayName(owner);
};

Template.details.maybeChosen = function(what)
{
	var myRsvp = _.find(this.rsvps, function(r)
	{
		return r.user === Meteor.userId();
	}) || {};
	return what == myRsvp.rsvp ? "chosen btn-inverse" : "";
};

Template.details.itemsForParty = function()
{
	var party = Parties.findOne(Session.get("selected"));
	if (! party) return []; // party hasn't loaded yet
	return party.items;
}
  
Template.details.DayString = function()
{
	var date = new Date(Session.get("Date"));
	return "Items for " + Months[date.getMonth()] + ", " + date.getDate();
}

//////////////////////////////////////////////////////////////////////
// Event listeners for details sidebar template

Template.details.events(
{
	'click .rsvp_yes': function()
	{
		Meteor.call("rsvp", Session.get("selected"), "yes");
		return false;
	},
	'click .rsvp_maybe': function()
	{
		Meteor.call("rsvp", Session.get("selected"), "maybe");
		return false;
	},
	'click .rsvp_no': function()
	{
		Meteor.call("rsvp", Session.get("selected"), "no");
		return false;
	},
	'click .invite': function()
	{
		openInviteDialog();
		return false;
	},
	'click .remove': function()
	{
		Parties.remove(this._id);
		return false;
	},
	'click .create': function()
	{
		if (!Meteor.userId()) return;
		var date = Session.get("Date");
		openCreateDialog(1, 1, date);
	},
	'click .edit': function()
	{
		if (!Meteor.userId() && !canEdit()) return;
		var date = Session.get("Date");
		// Parties.edit(this.id);
		openEditDialog(1, 1, date);
	},
	'click #ItemsButton': function()
	{
		var emptyText='New item text(click to edit)';
		Meteor.call("item", Session.get("selected"), emptyText);
		return false;
	}
});

///////////////////////////////////////////////////////////////////////////////
// User permissions

// If no one attend to the party, creator can delete it
Template.details.canRemove = function()
{
	return this.owner === Meteor.userId() && attending(this) === 0;
};

// If creator of party is logged in can edit this event
Template.event.canEdit = function()
{
	return this.owner === Meteor.userId();
};

// Any logged in user can create events
Template.event.canCreate = function()
{
	return true;
};

///////////////////////////////////////////////////////////////////////////////
// Party attendance widget

Template.attendance.rsvpName = function()
{
	var user = Meteor.users.findOne(this.user);
	return displayName(user);
};

Template.attendance.outstandingInvitations = function()
{
	var party = Parties.findOne(this._id);
	return Meteor.users.find(
	{
		$and:
		[
			{_id: {$in: party.invited}},                // they're invited
			{_id: {$nin: _.pluck(party.rsvps, 'user')}} // but haven't RSVP'd
		]
	});
};

Template.attendance.invitationName = function()
{
	return displayName(this);
};

Template.attendance.rsvpIs = function(what)
{
	return this.rsvp === what;
};

Template.attendance.nobody = function()
{
	return !this.public && (this.rsvps.length + this.invited.length === 0);
};

Template.attendance.canInvite = function()
{
	return !this.public && this.owner === Meteor.userId();
};

///////////////////////////////////////////////////////////////////////////////
// Calendar widget display

var Months = new Array("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December");

var adjustMonth = function (num)
{
	var date = new Date(Session.get("Date"));
	var nextMonth = new Date(date.getFullYear(), date.getMonth()+num+1, 0);
	if(date.getDate() > nextMonth.getDate())
	{
		date.setDate(nextMonth.getDate());
	}
	date.setMonth(date.getMonth()+num);
	Session.set("Date", date.toDateString());  
}

Template.calendar.DateString = function()
{
	var date = new Date(Session.get("Date"));
	return Months[date.getMonth()] + ", " + date.getFullYear();
}

Template.calendar.GetDays = function()
{
	var date      = new Date(Session.get("Date")),
	    start     = new Date(date.getFullYear(), date.getMonth(), 0),
		end       = new Date(date.getFullYear(), date.getMonth() + 1, 0),
        Days      = new Array({Number: "Su"}, {Number: "Mo"},
						  {Number: "Tu"}, {Number: "We"},
						  {Number: "Th"}, {Number: "Fr"},
						  {Number: "Sa"}),
		partyDays = Parties.find({date:{$gte:start, $lte:end}}).map(function(party)
		{
			var d = new Date(party.date),
			    o = { 'day': d.getDate(), 'id' : party._id};
			return o;
		});
		
	for(var i = 0; i < end.getDay(); i++)
	{
		Days.push({Number : "_"});
	}
	
	for(var i = 0; i < end.getDate(); i++)
	{
		if(date.getDate() == i + 1)
		{
			if (_.contains(_.pluck(partyDays, 'day'), i + 1))
			{
				Days.push(
				{
					'Number' : i + 1,
					'Class': " EventDaySelected",
					'id': _.pluck(partyDays, 'id')[_.pluck(partyDays, 'day').indexOf(i+1)]
				});
			}
			else
			{
				Days.push(
				{
					'Number' : i + 1,
					'Class': " DaySelected"
				});
			}
		}
		else if ( _.contains(_.pluck(partyDays, 'day'), i + 1))
		{
			Days.push(
			{
				'Number' : i + 1,
				'Class': " DayClick Event ",
				'id': _.pluck(partyDays, 'id')[_.pluck(partyDays, 'day').indexOf(i+1)]
			}); 
		}
		else
		{
			Days.push(
			{
				'Number' : i + 1,
				'Class': " DayClick"
			});
		}
	}
	return Days;
}

Template.calendar.events(
{
	'click #NextMonth': function()
	{
		adjustMonth(1);
	},
	'click #LastMonth': function()
	{
		adjustMonth(-1);
	},
	'click .DayClick': function(e)
	{
		var date = new Date(Session.get("Date"));
		date.setDate(this.Number);
		Session.set("Date", date.toDateString());
		// If no event is created today user can create one
		Template.event.canCreate = function() {return true;}
		if(e.currentTarget.id != '')
		{
			Session.set("selected", e.currentTarget.id);
		}
		else
		{
			// Increment current node until target meets node with class Event,
			// this means there is an event, try to animate this movement
			// using jquery
			//$(e.currentTarget).nextUntil(".Event").addClass("DaySelected");
		}
	},
	'click .Event': function()
	{
		// If event already exist user cannot create one
		Template.event.canCreate = function() {return false;}
	}
});


///////////////////////////////////////////////////////////////////////////////
// Map display

// Use jquery to get the position clicked relative to the map element.
// Relative coords to element => relCoords
var relCoords = function(element, event)
{
	var offset = $(element).offset();
	var x = event.pageX - offset.left;
	var y = event.pageY - offset.top;
	return { x: x, y: y };
};

Template.map.events(
{
	'mousedown circle, mousedown text': function(event, template)
	{
		Session.set("selected", event.currentTarget.id);
	},
	'dblclick .map': function(event, template)
	{
		if (!Meteor.userId()) return;
		var coords = relCoords(event.currentTarget, event);
		openCreateDialog(coords.x / 500, coords.y / 500);
	}
});

Template.map.rendered = function()
{
	var self = this;
	self.node = self.find("svg");
	if (!self.handle)
	{
		self.handle = Meteor.autorun(function()
		{
			var selected = Session.get('selected');
			var selectedParty = selected && Parties.findOne(selected);
			var radius = function(party)
			{
				return 10 + Math.sqrt(attending(party)) * 20;
			};	
			
			// Draw a circle for each party
			var updateCircles = function(group)
			{
				group.attr("id", function(party) {return party._id;})
				     .attr("cx", function(party) {return party.x * 500;})
					 .attr("cy", function(party) {return party.y * 500;})
					 .attr("r",  radius)
					 .attr("class", function(party)
					 {
						return party.public ? "public" : "private";
					})
					.style('opacity', function(party)
					{
						return selected === party._id ? 1 : 0.6;
					});
			};
			
			var circles = d3.select(self.node).select(".circles").selectAll("circle")
			.data(Parties.find().fetch(),function(party){ return party._id; });
			
			updateCircles(circles.enter().append("circle"));
			updateCircles(circles.transition().duration(250).ease("cubic-out"));
			circles.exit().transition().duration(250).attr("r", 0).remove();

      // Label each with the current attendance count
      var updateLabels = function (group) {
        group.attr("id", function (party) { return party._id; })
        .text(function (party) {return attending(party) || '';})
        .attr("x", function (party) { return party.x * 500; })
        .attr("y", function (party) { return party.y * 500 + radius(party)/2 })
        .style('font-size', function (party) {
          return radius(party) * 1.25 + "px";
        });
      };

      var labels = d3.select(self.node).select(".labels").selectAll("text")
        .data(Parties.find().fetch(), function (party) { return party._id; });

      updateLabels(labels.enter().append("text"));
      updateLabels(labels.transition().duration(250).ease("cubic-out"));
      labels.exit().remove();

      // Draw a dashed circle around the currently selected party, if any
      var callout = d3.select(self.node).select("circle.callout")
        .transition().duration(250).ease("cubic-out");
		
      if (selectedParty)
		
        callout.attr("cx", selectedParty.x * 500)
        .attr("cy", selectedParty.y * 500)
        .attr("r", radius(selectedParty) + 10)
        .attr("class", "callout")
        .attr("display", '');
		/*var speed = 4;
		d3.timer(function() {
  var angle = (Date.now() - 1933) * speed,
      transform = function(d) { return "rotate(" + angle / d.radius + ")"; };
  callout.attr("transform", transform); // frame of reference
});*/
		
      else
        callout.attr("display", 'none');
    });
  }
};

Template.map.destroyed = function () {
  this.handle && this.handle.stop();
};

///////////////////////////////////////////////////////////////////////////////
// Create Party dialog

var openCreateDialog = function (x, y, date) {
  Session.set("createCoords", {x: x, y: y});
  Session.set("createError", null);
  Session.set("showCreateDialog", true);
};

Template.page.showCreateDialog = function () {
  return Session.get("showCreateDialog");
};

Template.createDialog.events({
  'click .save': function (event, template) {
    var title = template.find(".title").value;
    var description = template.find(".description").value;
    var public = ! template.find(".private").checked;
    var coords = Session.get("createCoords");
    var date = new Date(Session.get("Date"));

    if (title.length && description.length) {
      Meteor.call('createParty', {
        title: title,
        description: description,
        x: coords.x,
        y: coords.y,
        date: date,
        public: public
      }, function (error, party) {
        if (! error) {
          Session.set("selected", party);
          if (! public && Meteor.users.find().count() > 1)
            openInviteDialog();
        }
      });
      Session.set("showCreateDialog", false);
	  console.log("Error at field length.");
    } else {
      Session.set("createError",
                  "It needs a title and a description, or why bother?");
    }
  },

  'click .cancel': function () {
    Session.set("showCreateDialog", false);
  }
});

Template.createDialog.error = function () {
  return Session.get("createError");
};

Template.createDialog.date = function () {
  return Session.get("Date");
};

///////////////////////////////////////////////////////////////////////////////
// Edit Party dialog

var openEditDialog = function (x, y, date) {
  Session.set("editCoords", {x: x, y: y});
  Session.set("editError", null);
  Session.set("showEditDialog", true);
};

Template.page.showEditDialog = function () {
  return Session.get("showEditDialog");
};

Template.editDialog.events({
  'click .save': function (event, template) {
    var title = template.find(".title").value;
    var description = template.find(".description").value;
    var public = ! template.find(".private").checked;
    var coords = Session.get("editCoords");
    var date = new Date(Session.get("Date"));

    if (title.length && description.length) {
      Meteor.call('editParty', {
        title: title,
        description: description,
           // todo: x <- user click event coords
		x: coords.x,
		   // todo: y <- user click event coords
        y: coords.y,
        date: date,
        public: public
      }, function (error, party) {
        if (! error) {
          Session.set("selected", party);
          if (! public && Meteor.users.find().count() > 1)
            openInviteDialog();
        }
      });
      Session.set("showEditDialog", false);
	  console.log("Error at field length.");
    } else {
      Session.set("createError",
                  "It needs a title and a description, or why bother?");
    }
  },

  'click .cancel': function () {
    Session.set("showEditDialog", false);
  }
});

Template.editDialog.error = function () {
  return Session.get("editError");
};

Template.editDialog.date = function () {
  return Session.get("Date");
};

///////////////////////////////////////////////////////////////////////////////
// Invite dialog

var openInviteDialog = function () {
  Session.set("showInviteDialog", true);
};

Template.page.showInviteDialog = function () {
  return Session.get("showInviteDialog");
};

Template.inviteDialog.events({
  'click .invite': function (event, template) {
    Meteor.call('invite', Session.get("selected"), this._id);
  },
  'click .done': function (event, template) {
    Session.set("showInviteDialog", false);
    return false;
  }
});

Template.inviteDialog.uninvited = function () {
  var party = Parties.findOne(Session.get("selected"));
  if (! party)
    return []; // party hasn't loaded yet
  return Meteor.users.find({$nor: [{_id: {$in: party.invited}},
                                   {_id: party.owner}]});
};

Template.inviteDialog.displayName = function () {
  return displayName(this);
};
