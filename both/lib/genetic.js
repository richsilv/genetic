var indexRegex = /(?:p)(\d+)/g;

NodeFuncs = {
	add: function(x, y) {
		return x + y;
	},
	subtract: function(x, y) {
		return x - y;
	},
	multiply: function(x, y) {
		return x * y;
	},
	divide: function(x, y) {
		return x / y;
	}
}

allOps = [{
	moniker: '\\\+',
	func: NodeFuncs.add,
	args: 2
}, {
	moniker: '\\\-',
	func: NodeFuncs.subtract,
	args: 2
}, {
	moniker: '\\\*',
	func: NodeFuncs.multiply,
	args: 2
}, {
	moniker: '\\\/',
	func: NodeFuncs.divide,
	args: 2
}, {
	moniker: '\\\^',
	func: Math.power,
	args: 2
}, {
	moniker: '\\\,',
	func: null,
	args: 0
}];
allFuncs = [{
	moniker: 'sin',
	func: Math.sin,
	args: 1
}, {
	moniker: 'cos',
	func: Math.cos,
	args: 1
}, {
	moniker: 'tan',
	func: Math.tan,
	args: 1
}, {
	moniker: 'max',
	func: Math.max,
	args: 2
}, {
	moniker: 'min',
	func: Math.min,
	args: 2
}];

var separators = ['\\\+', '-', '\\*', '/'],
	tokens = [{
		regex: /^\d+\.?\d*$/,
		func: function(t) {
			return this.makeLeaf(parseFloat(t[0], 10));
		}
	},
	{
		regex: /^(?:l)(-?\d+)$/,
		func: function(t) {
			return this.makeLeaf({
				lag: parseInt(t[1], 10)
			});
		}
	},
	{
		regex: new RegExp('^' + _.pluck(allOps, 'moniker').join('|') + '$'),
		func: function(t) {
			var op = _.find(allOps, function(o) {return new RegExp(o.moniker).exec(t);});
			return op ? {
				operator: op.func,
				args: op.args
			} : null;
		}
	},
	{
		regex: new RegExp('^' + _.pluck(allFuncs, 'moniker').join('|') + '$'),
		func: function(t) {
			var thisFunc = _.find(allOps, function(f) {return new RegExp(f.moniker).exec(t);});
			return op ? {
				func: thisFunc.func,
				args: thisFunc.args
			} : null;
		}
	}
	];

function construct(constructor, args) {
	return new(constructor.bind.apply(constructor, [null].concat(args)));
}

Genetic = function(seq) {

	var _this = this,
		args = Array.prototype.slice.call(arguments);

	this.length = seq.length;
	this.seq = seq;

	this.makeLeaf = function(content) {
		return new Leaf(_this, content);
	}

	this.makeNode = function() {
		var theseArgs = Array.prototype.slice.call(arguments);
		extendedArgs = [_this].concat(theseArgs);
		return construct(FNode, extendedArgs);
	}

	this.buildNode = function() {
		var newNode = this.makeNode.apply(this, arguments);
		this.topNode = newNode;
		return this.topNode;
	}

	this.topNode = this.makeNode(_.identity, this.makeLeaf(1));

	this.evaluate = function() {
		return _this.topNode.evaluate();
	}

};

FNode = function() {

	var _this = this,
		args = Array.prototype.slice.call(arguments);

	this.children = [];
	this.parent = null;

	this.owner = args[0];
	this.func = args[1];
	this.children = args.slice(2);

	_.each(args.slice(1), function(c) {
		if (c instanceof FNode || c instanceof Leaf) c.parent = _this;
	});

	this.evaluate = function(point) {

		if (point === undefined) {
			return funcMap.call(_this, _this.func, _.map(_this.children, function(child) {
				return child.evaluate();
			}));
		} else {
			return _this.func.apply(_this, _.map(_this.children, function(content) {
				return content.evaluate(point);
			}));
		}

	}

};

Leaf = function(owner, content) {

	var _this = this;

	this.parent = null;
	this.content = content;
	this.owner = owner;

	this.evaluate = function(point) {
		if (point === undefined) {
			if (typeof _this.content === 'number') return _.map(_this.owner.seq, function() {
				return _this.content;
			});
			else if (_.has(_this.content, 'lag')) return _.map(_this.owner.seq, function(q, i) {
				return _this.owner.seq[i - _this.content.lag] || 0;
			});
		}

		if (typeof _this.content === 'number') return _this.content;
		else if (_.has(_this.content, 'lag')) return _this.owner.seq[point - _this.content.lag] || null;
	}

}

function funcMap(func, children) {
	var _this = this,
		zippedArray = _.zip.apply(null, children);
	return _.map(zippedArray, function(pointArray) {
		return func.apply(_this, pointArray);
	});
}

ETree = function(data, parent) {

	this.data = data;
	this.parent = parent;
	this.id = Random.id();
	this.get = function(context) {
		return _.map(this.data, function(d) {
			if (d instanceof ETree) return d.get(context);
			else return expSimple.call(context, d);
		});
	}

};

Genetic.prototype.expParse = function(exp) {
	var tree = new ETree([], null),
		current = tree,
		liveExp = '',
		ind = 0,
		length,
		scheme,
		converter = schemeConvert.bind(this);
	exp = exp.replace(/\s/g, '');
	length = exp.length;
	for (; ind < length; ind++) {
		switch (exp[ind]) {
			case '(':
				if (liveExp.length) current.data.push(liveExp);
				liveExp = '';
				var newTree = new ETree([], current)
				current.data.push(newTree);
				current = newTree;
				break;
			case ')':
				if (liveExp.length) current.data.push(liveExp);
				liveExp = '';
				current = current.parent;
				break;
			default:
				liveExp += exp[ind];
				break;
		}
	}
	if (liveExp.length) current.data.push(liveExp);
	if (tree.id !== current.id) throw new Meteor.Error('unbalanced_parentheses', 'Parentheses are unbalanced.', tree);
	scheme = tree.get(this);
	return scheme;
	ind = 0;
	schemeConvert(tree);
};

schemeConvert = function(scheme) {

	var ind = 0;

}


expSimple = function(exp) {

	var theseTokens = exp.split(new RegExp('(' + _.pluck(allOps, 'moniker').join('|') + ')', 'g')).filter(function(s) {
		return s.length;
	});
	return _.map(theseTokens, convertToken.bind(this));

}

convertToken = function(token) {
	var thisToken = _.find(tokens, function(t) {
		return t.regex.exec(token);
	});
	return thisToken ? thisToken.func.call(this, thisToken.regex.exec(token)) : {error: 'unknown'};
}