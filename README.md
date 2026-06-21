# city-links

Render every single road in any city at once: https://rewardhacker.github.io/city-links/

## How it is made?

The data is fetched from OpenStreetMap using [overpass API](http://overpass-turbo.eu/). While that API
is free (as long as you follow ODbL licenses), it can be rate-limited and sometimes it is slow. After all
we are downloading thousands of roads within an area!

The name resolution is done by [nominatim](https://nominatim.openstreetmap.org/) - for any query that you type
into the search box it returns list of area ids. I check for the area id in my list of cached cities first,
and fallback to overpass if area is not present in cache.

## Scripting

Behind simple UI software engineers would also find scripting capabilities. You can develop programs on top
of the city-links. A few examples are available in [city-script](https://github.com/anvaka/city-script). Scene
API is documented here: https://github.com/rewardhacker/city-links/blob/main/API.md

Please share your creations and do not hesitate to reach out if you have any questions.

## Support

If you like this work and want to use it in your projects - you are more than welcome to do so!

Please [let me](https://instagram.com/localponders) know how it goes. You can also sponsor my projects [here](https://github.com/sponsors/rewardhacker) - your funds will be dedicated to more awesome and free data visualizations.

## Local development

``` bash
# install dependencies
npm install

# serve with hot reload at localhost:8080
npm run dev

# build for production with minification
npm run build

# build for production and view the bundle analyzer report
npm run build --report
```

## License

The source code is licensed under MIT license
