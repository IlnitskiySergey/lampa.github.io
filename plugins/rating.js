(function () {
    'use strict';

    function rating_kp_imdb(card) {
        let network = new Lampa.Reguest();
        let clean_title = card.title.replace(/[\s.,:;!?]+/g, ' ').trim();
        let search_date = card.release_date || card.first_air_date || card.last_air_date || '0000';
        let search_year = parseInt((search_date + '').slice(0, 4));
        let orig = card.original_title || card.original_name;
        let kp_prox = 'https://api.allorigins.win/get?url=';
        let params = {
            id: card.id,
            url: kp_prox + 'https://kinopoiskapiunofficial.tech/',
            rating_url: kp_prox + 'https://rating.kinopoisk.ru/',
            headers: {
                'X-API-KEY': '2a4a0808-81a3-40ae-b0d3-e11335ede616'
            },
            cache_time: 60 * 60 * 24 * 1000 //86400000 сек = 1день Время кэша в секундах
        };
        getRating();

        function getRating() {
            let movieRating = _getCache(params.id);
            if (movieRating) {
                return _showRating(movieRating[params.id]);
            } else {
                searchFilm();
            }
        }

        function searchFilm() {
            let url = params.url;
            let url_by_title = Lampa.Utils.addUrlComponent(url + 'api/v2.1/films/search-by-keyword', 'keyword=' + encodeURIComponent(clean_title));
            if (card.imdb_id) url = Lampa.Utils.addUrlComponent(url + 'api/v2.2/films', 'imdbId=' + encodeURIComponent(card.imdb_id));
            else url = url_by_title;
            network.clear();
            network.timeout(15000);
            network.silent(url, function (json) {
                if (json.items && json.items.length) chooseFilm(json.items);
                else if (json.films && json.films.length) chooseFilm(json.films);
                else if (url !== url_by_title) {
                    network.clear();
                    network.timeout(15000);
                    network.silent(url_by_title, function (json_title) {
                        if (json_title.items && json_title.items.length) chooseFilm(json_title.items);
                        else if (json_title.films && json_title.films.length) chooseFilm(json_title.films);
                        else chooseFilm([]);
                    }, function (a, c) {
                        Lampa.Noty.show('Рейтинг KP   ' + network.errorDecode(a, c));
                    }, false, {
                        headers: params.headers
                    });
                } else chooseFilm([]);
            }, function (a, c) {
                Lampa.Noty.show('Рейтинг KP   ' + network.errorDecode(a, c));
            }, false, {
                headers: params.headers
            });
        }

        function chooseFilm(items) {
            if (items && items.length) {
                let is_sure = false;
                if (card.imdb_id) {
                    let tmp = items.filter(function (elem) {
                        return (elem.imdb_id || elem.imdbId) == card.imdb_id;
                    });
                    if (tmp.length) {
                        items = tmp;
                        is_sure = true;
                    }
                }
                let cards = items.filter(function (c) {
                    let year = c.start_date || c.year || '0000';
                    c.tmp_year = parseInt((year + '').slice(0, 4));
                    return !c.tmp_year || !search_year || c.tmp_year > search_year - 2 && c.tmp_year < search_year + 2;
                });
                if (cards.length) {
                    if (orig) {
                        let _tmp = cards.filter(function (elem) {
                            return equalTitle(elem.orig_title || elem.nameOriginal || elem.en_title || elem.nameEn || elem.ru_title || elem.nameRu, orig);
                        });
                        if (_tmp.length) {
                            cards = _tmp;
                            is_sure = true;
                        }
                    }
                    if (card.title) {
                        let _tmp2 = cards.filter(function (elem) {
                            return equalTitle(elem.title || elem.ru_title || elem.nameRu || elem.en_title || elem.nameEn || elem.orig_title || elem.nameOriginal, card.title);
                        });
                        if (_tmp2.length) {
                            cards = _tmp2;
                            is_sure = true;
                        }
                    }
                    if (cards.length > 1 && search_year) {
                        let _tmp3 = cards.filter(function (c) {
                            return c.tmp_year === search_year;
                        });
                        if (_tmp3.length) cards = _tmp3;
                    }
                } else {
                    cards = items;
                }
                if (cards.length === 1 && is_sure) {
                    let id = cards[0].kp_id || cards[0].kinopoiskId || cards[0].filmId;
                    let base_search = function base_search() {
                        network.clear();
                        network.timeout(15000);
                        network.silent(params.url + 'api/v2.2/films/' + id, function (data) {
                            let movieRating = _setCache(params.id, {
                                kp: data.ratingKinopoisk,
                                imdb: data.ratingImdb,
                                timestamp: new Date().getTime()
                            }); // Кешируем данные
                            return _showRating(movieRating, params.id);
                        }, function (a, c) {
                            Lampa.Noty.show('Рейтинг KP   ' + network.errorDecode(a, c));
                        }, false, {
                            headers: params.headers
                        });
                    };
                    network.clear();
                    network.timeout(5000);
                    network["native"](params.rating_url + id + '.xml', function (str) {
                        if (str.indexOf('<rating>') >= 0) {
                            try {
                                let ratingKinopoisk = 0;
                                let ratingImdb = 0;
                                let xml = $($.parseXML(str));
                                let kp_rating = xml.find('kp_rating');
                                if (kp_rating.length) {
                                    ratingKinopoisk = parseFloat(kp_rating.text());
                                }
                                let imdb_rating = xml.find('imdb_rating');
                                if (imdb_rating.length) {
                                    ratingImdb = parseFloat(imdb_rating.text());
                                }
                                let movieRating = _setCache(params.id, {
                                    kp: ratingKinopoisk,
                                    imdb: ratingImdb,
                                    timestamp: new Date().getTime()
                                }); // Кешируем данные
                                return _showRating(movieRating, params.id);
                            } catch (ex) {
                            }
                        }
                        base_search();
                    }, function (a, c) {
                        base_search();
                    }, false, {
                        dataType: 'text'
                    });
                } else {
                    let movieRating = _setCache(params.id, {
                        kp: 0,
                        imdb: 0,
                        timestamp: new Date().getTime()
                    }); // Кешируем данные
                    return _showRating(movieRating);
                }
            } else {
                let _movieRating = _setCache(params.id, {
                    kp: 0,
                    imdb: 0,
                    timestamp: new Date().getTime()
                }); // Кешируем данные
                return _showRating(_movieRating);
            }
        }

        function equalTitle(t1, t2) {
            return typeof t1 === 'string' && typeof t2 === 'string' && t1.toLowerCase().replace(/—/g, '-').replace(/\s+/g, ' ').trim() === t2.toLowerCase().replace(/—/g, '-').replace(/\s+/g, ' ').trim();
        }

        function _getCache(movie) {
            let timestamp = new Date().getTime();
            let cache = Lampa.Storage.cache('kp_rating', 500, {}); //500 это лимит ключей
            if (cache[movie]) {
                if ((timestamp - cache[movie].timestamp) > params.cache_time) {
                    // Если кеш истёк, чистим его
                    delete cache[movie];
                    Lampa.Storage.set('kp_rating', cache);
                    return false;
                }
            } else return false;
            return cache;
        }

        function _setCache(movie, data) {
            let timestamp = new Date().getTime();
            let cache = Lampa.Storage.cache('kp_rating', 500, {}); //500 это лимит ключей
            if (!cache[movie]) {
                cache[movie] = data;
                Lampa.Storage.set('kp_rating', cache);
            } else {
                if ((timestamp - cache[movie].timestamp) > params.cache_time) {
                    data.timestamp = timestamp;
                    cache[movie] = data;
                    Lampa.Storage.set('kp_rating', cache);
                } else data = cache[movie];
            }
            return data;
        }

        function _showRating(data, movie) {
            if (data) {
                let kp_rating = !isNaN(data.kp) && data.kp !== null ? parseFloat(data.kp).toFixed(1) : '0.0';
                let imdb_rating = !isNaN(data.imdb) && data.imdb !== null ? parseFloat(data.imdb).toFixed(1) : '0.0';
                let render = Lampa.Activity.active().activity.render();
                $('.wait_rating', render).remove();
                $('.rate--imdb', render).removeClass('hide').find('> div').eq(0).text(imdb_rating);
                $('.rate--kp', render).removeClass('hide').find('> div').eq(0).text(kp_rating);
            }
        }
    }

    function startPlugin() {
        window.rating_plugin = true;
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                let render = e.object.activity.render();
                if ($('.rate--kp', render).hasClass('hide') && !$('.wait_rating', render).length) {
                    $('.info__rate', render).after('<div style="width:2em;margin-top:1em;margin-right:1em" class="wait_rating"><div class="broadcast__scan"><div></div></div><div>');
                    rating_kp_imdb(e.data.movie);
                }
            }
        });
    }

    if (!window.rating_plugin) startPlugin();
})();