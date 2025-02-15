import http from 'k6/http'
import { Rate, Trend } from 'k6/metrics'
import { check, group, fail, sleep } from 'k6'

import Metrics from './lib/metrics.js';
import { isOK, itemAddedToCart, cartHasProduct, orderWasPlaced } from './lib/checks.js'
import { rand, sample, validateSiteUrl, responseWasCached, bypassPageCacheCookies } from './lib/helpers.js'

import faker from 'https://cdn.jsdelivr.net/npm/faker@5.5.3/dist/faker.min.js'

export const options = {
    throw: true,
    summaryTimeUnit: 'ms',
    scenarios: {
        ramping: {
            executor: 'ramping-vus',
            startVUs: 1,
            gracefulStop: '10s',
            gracefulRampDown: '10s',
            stages: [
                { duration: '1m', target: 100 },
            ],
        },
        // constant: {
        //     executor: 'constant-vus',
        //     vus: 100,
        //     duration: '1m',
        //     gracefulStop: '10s',
        // },
    },
    ext: {
        loadimpact: {
            name: 'WooCommerce checkout flow',
            note: 'Loads the homepage, selects and loads a random category, selects a random product and adds it to the cart, loads the cart page and then places an order.',
            projectID: __ENV.PROJECT_ID || null
        },
    },
}

const errorRate = new Rate('errors')
const responseCacheRate = new Rate('response_cached')

// These metrics are provided by Object Cache Pro when `analytics.footnote` is enabled
const metrics = new Metrics();

export default function () {
    const jar = new http.CookieJar()
    const siteUrl = __ENV.SITE_URL

    validateSiteUrl(siteUrl);

    const pause = {
        min: 3,
        max: 8,
    }

    if (__ENV.BYPASS_CACHE) {
        Object.entries(bypassPageCacheCookies()).forEach(([key, value]) => {
            jar.set(siteUrl, key, value, { path: '/' })
        })
    }

    // const categories = group('Load homepage', function () {
    //     const response = http.get(siteUrl + "/shop", { jar })
    //
    //     check(response, isOK)
    //         || (errorRate.add(1) && fail('status code was *not* 200'))
    //
    //     metrics.addResponseMetrics(response)
    //     responseCacheRate.add(responseWasCached(response))
    //
    //     return response.html()
    //         .find('li.product-category > a')
    //         .map((idx, el) => String(el.attr('href')))
    //         .filter(href => ! href.includes('/decor/')) // skip WP swag
    // })
    //
    // sleep(rand(pause.min, pause.max))

    const products = group('Load shop page', function () {
        const response = http.get(siteUrl + "/shop/page/" + rand(1,3), { jar })

        check(response, isOK)
            || (errorRate.add(1) && fail('status code was *not* 200'))

        metrics.addResponseMetrics(response)
        responseCacheRate.add(responseWasCached(response))

        return response.html()
            .find('.products')
            .find('.product:not(.product-type-variable,.outofstock)') // skip products
            .find('.woocommerce-loop-product__link')
            .map((idx, el) => el.attr('href'))
    })

    sleep(rand(pause.min, pause.max))

    group('Load and add product to cart', function () {
        const product = sample(products)
        const response = http.get(product, { jar })

        check(response, isOK)
            || (errorRate.add(1) && fail('status code was *not* 200'))

        metrics.addResponseMetrics(response)
        responseCacheRate.add(responseWasCached(response))

        const fields = response.html()
            .find('.input-text.qty')
            .map((idx, el) => el.attr('name'))
            .reduce((obj, key) => {
                obj[key] = 1

                return obj
            }, {})

        const formResponse = response.submitForm({
            formSelector: 'form.cart',
            fields,
            params: { jar },
        })

        check(formResponse, isOK)
            || (errorRate.add(1) && fail('status code was *not* 200'))

        check(formResponse, itemAddedToCart)
            || fail('items *not* added to cart')

        metrics.addResponseMetrics(formResponse)
        responseCacheRate.add(responseWasCached(formResponse))
    })

    sleep(rand(pause.min, pause.max))

    group('Load cart', function () {
        const response = http.get(`${siteUrl}/cart`, { jar })

        check(response, isOK)
            || (errorRate.add(1) && fail('status code was *not* 200'))

        check(response, cartHasProduct)
            || fail('cart was empty')

        metrics.addResponseMetrics(response)
        responseCacheRate.add(responseWasCached(response))
    })

    sleep(rand(pause.min, pause.max))

    group('Place order', function () {
        const response = http.get(`${siteUrl}/checkout`, { jar })

        check(response, isOK)
            || (errorRate.add(1) && fail('status code was *not* 200'))

        metrics.addResponseMetrics(response)
        responseCacheRate.add(responseWasCached(response))

        const fields = {
            billing_first_name: faker.name.firstName(),
            billing_last_name: faker.name.lastName(),
            billing_company: faker.datatype.boolean() ? faker.company.companyName() : null,
            billing_country: 'US',
            billing_state: faker.address.stateAbbr(),
            billing_address_1: faker.address.streetAddress(),
            billing_address_2: faker.datatype.boolean() ? faker.address.secondaryAddress() : null,
            billing_city: faker.address.city(),
            billing_postcode: faker.address.zipCodeByState('DE'),
            billing_phone: faker.phone.phoneNumberFormat(),
            billing_email: rand(1, 100) + '-' + faker.internet.exampleEmail(),
            order_comments: faker.datatype.boolean() ? faker.lorem.sentences() : null,
        }

        const formResponse = response.submitForm({
            formSelector: 'form[name="checkout"]',
            params: { jar },
            fields,
        })

        check(formResponse, orderWasPlaced)
            || fail('order was *not* placed')

        metrics.addResponseMetrics(formResponse)
        responseCacheRate.add(responseWasCached(formResponse))
    })
}
