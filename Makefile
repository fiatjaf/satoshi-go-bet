all: static/bundle.js static/style.css

deploy: prod
	netlify deploy --prod -d static/

prod: static/bundle.min.js static/style.min.css
	mv static/bundle.min.js static/bundle.js
	mv static/style.min.css static/style.css

static/bundle.js: $(shell find client -name "*.js")
	godotenv -f dev.env ./node_modules/.bin/browserify client/App.js -dv --outfile static/bundle.js

static/bundle.min.js: $(shell find client -name "*.js")
	godotenv -f prod.env ./node_modules/.bin/browserify client/App.js -g [ envify --NODE_ENV production ] -g uglifyify | ./node_modules/.bin/terser --compress --mangle > static/bundle.min.js

static/style.css: client/style.styl
	./node_modules/.bin/stylus < client/style.styl > static/style.css

static/style.min.css: client/style.styl
	./node_modules/.bin/stylus -c < client/style.styl > static/style.min.css
