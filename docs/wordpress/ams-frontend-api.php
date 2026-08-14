<?php
/**
 * Plugin Name: AMS Frontend API
 * Description: General-purpose endpoints for the AMS Infotainment Next.js frontend (add new ones here as needed). Read-only + a standalone hero-slider embed + the homepage featured-program picker + anonymous REST commenting + per-user login tokens for authenticated writes + program custom-meta exposed to REST + skips AMS Cache's synchronous page warmer on dashboard writes (96s -> under 1s). Self-contained — deactivate/delete anytime with zero effect on anything else.
 * Version:     1.9.0
 * Author:      Soth Kimleng
 *
 * Standalone "add endpoints as needed" API file, separate from the legacy
 * AMS3E-API plugin. Everything is prefixed `ams_afa_`, creates no tables, and
 * Deactivate → Delete leaves behind exactly one option (see below).
 *
 * ── Endpoints ────────────────────────────────────────────────────────────────
 *  GET /wp-json/wp/v2/web/tv-show-episodes?tv_show=<id>   episodes of a TV show
 *        Obsok=14512, One-Minute-for-Health=14570   (&page_no= &page_size=)
 *        Since 1.5.0 each row also carries run_time + release_date, so the
 *        frontend's episode lists can print "27:29 នាទី | Added: 09.11.2022".
 *
 *  GET /wp-json/wp/v2/web/episode?id=<id>                 one episode, in full
 *        Video source, run time, release date, parent show + season name — all
 *        of it private MasVideos meta that core REST will not expose.
 *
 *  GET /wp-json/wp/v2/web/featured-program                the homepage's video
 *        banner. Which program, and the artwork behind it, are picked in
 *        Settings → Featured Program. Answers { status, data: null } when unset.
 *  POST /wp-json/wp/v2/web/featured-program  { movie_id, bg_image }  (1.7.4)
 *        The same setting, writable by the dashboard's Settings screen
 *        (manage_options, via X-AMS-Token). Pings the frontend's
 *        featured-program cache tag on success.
 *
 *  POST /wp-json/wp/v2/web/login   { username, password }  issue a login token
 *        Authenticates a REAL WordPress user (the credentials they already use —
 *        NOT an application password) and returns a signed, 12h bearer token plus
 *        { id, name, username, roles, capabilities }. Send the token back on every
 *        write in an  X-AMS-Token:  header (see the auth note below) and the REST
 *        call runs AS that user, with WordPress enforcing capabilities natively.
 *        401 on bad credentials, 403 if the account has no dashboard access,
 *        429 once an IP trips the brute-force throttle. Requires HTTPS.
 *
 *  GET /wp-json/wp/v2/web/me                               who the token is
 *        The same { id, name, username, roles, capabilities } for whoever the
 *        X-AMS-Token identifies. The frontend calls it to re-validate a stored
 *        session and refresh role gating. 401 when the token is missing/expired.
 *
 *  GET /wp-json/wp/v2/web/roles                            all roles + caps (1.7.5)
 *        Every role with its display name, granted capability list and user
 *        count — the dashboard's read-only Role Management screen. Gated on
 *        list_users (same as the Users screen), via X-AMS-Token.
 *
 *  GET /hero-embed[?alias=<slider alias>]                 standalone Slider
 *        Renders ONE Slider Revolution slider (no theme chrome), for embedding
 *        in the Next frontend via an <iframe>. Defaults to the homepage slider;
 *        `?alias=` picks a landing page's own (whitelisted below — an unknown
 *        alias falls back to the homepage one). Sends a frame-ancestors header
 *        so the frontend origins below may embed it, posts its height to the
 *        parent for responsive auto-sizing, and forwards slide-link clicks to
 *        the parent as postMessage — an <a> inside the iframe would otherwise
 *        navigate the visitor off the frontend and onto WordPress.
 *
 *  GET /sr-embed?alias=<slider alias>                     ANY slider   (1.8.0)
 *        The same standalone renderer, for sliders nobody can whitelist ahead
 *        of time: article bodies embed Slider Revolution modules with generated
 *        aliases (INFHB010_01, …), and post_content carries the module markup
 *        WITHOUT the runtime that draws it — no sr7.css, no sr7.js, no per-module
 *        SR7.JSON — so the frontend renders collapsed inline elements. Framing
 *        this route instead gives the module the WordPress page it needs.
 *        Unlike /hero-embed there is NO fallback: an alias that names no real
 *        slider 404s. Safety comes from checking Slider Revolution's own table
 *        (ams_afa_slider_alias) rather than from a hand-kept list.
 *
 * ── Behaviour changes ────────────────────────────────────────────────────────
 *  Anonymous REST comments: WordPress supports anonymous commenting via the
 *        classic wp-comments-post.php but blocks it over REST by default. The
 *        site's discussion settings already allow anonymous comments, so the
 *        `rest_allow_anonymous_comments` filter below simply lets REST agree
 *        with them. Comment moderation settings still apply unchanged.
 *
 *  Program custom meta over REST: MasVideos/Vodi keep a program's real fields
 *        (video source, release date, broadcast schedule, backdrop, the show
 *        link, and the episode fields) in private `_`-prefixed post meta that
 *        core REST hides — `wp/v2/movie|tv_show|episode` answer `meta: []`. The
 *        `register_post_meta` block below exposes just the CURATED set the
 *        dashboard editor writes (show_in_rest + an edit-capability auth_callback),
 *        so `?context=edit` now returns them and PATCH can write them. It exposes
 *        nothing it doesn't need (no `_seasons`, trailer, buy-ticket, IMDb/TMDb).
 *
 *  Program edit capabilities: MasVideos gives movie/tv_show/episode their own
 *        capability set, and this site's roles were never granted all of it
 *        (editing someone else's / a published program via REST returned 403).
 *        1.7.1 tried writing the missing caps onto the Administrator role with
 *        add_cap; that proved ineffective, so since 1.7.2 a `user_has_cap`
 *        filter answers the checks at runtime instead: Administrators pass any
 *        program cap, other roles extend the base program caps they already
 *        hold (edit_movies → edit_others/published_movies, …). Nothing is
 *        written to roles anymore; whatever 1.7.1 recorded as added is still
 *        handed back on deactivation.
 *
 *  Per-user token auth: a `determine_current_user` filter reads the X-AMS-Token
 *        header, verifies the /login token (HMAC over `wp_salt('auth')`, and
 *        additionally bound to a fragment of the user's password hash so that
 *        changing the password silently revokes every outstanding token) and,
 *        when it is valid, runs the request as that user. No cookies, no REST
 *        nonce, and no wp-config / .htaccess changes — a request with no header,
 *        or an already-authenticated wp-admin request, is left exactly as it was.
 *
 * ── Admin ────────────────────────────────────────────────────────────────────
 *  Settings → Featured Program      writes the option `ams_afa_featured_program`
 *        ({ movie_id, bg_image }).
 *  Settings → Frontend Cache        writes the option `ams_afa_revalidate`
 *        ({ url, secret }) — the publish→frontend revalidation webhook (1.7.3).
 *        These two options are the plugin's only stored state.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/* ─────────────────────────────── CONFIG ───────────────────────────────────── */

// The Slider Revolution alias shown as the homepage hero (and the fallback for
// any ?alias= this plugin doesn't recognise).
define( 'AMS_AFA_HERO_ALIAS', 'homepage-2' );

/**
 * The sliders /hero-embed may render, read off the live landing pages'
 * `data-alias` markup (several pages share one slider). A WHITELIST because the
 * alias arrives in the query string, and "render any shortcode argument a
 * visitor sends" is not a door to leave open.
 */
function ams_afa_hero_aliases() {
    return array(
        AMS_AFA_HERO_ALIAS,           // homepage
        'cover-animation-14-12',      // /entertainment-news
        'cover-animation-11',         // /life-style
        'entainment-home-page-1',     // /celebrity
        'entainment-home-page-1-1',   // /movie-and-music, /culture
        'entainment-home-page-1-1-1', // /strange
        'life-style-home-page-1',     // /life-style/travel, /life-style/architecture
        'life-style-home-page-1-1',   // /life-style/love-and-relation
        'life-style-home-page-1-1-1', // /life-style/health-and-beauty
        'celebrity-new-1',            // /life-style/life-tips
    );
}

/**
 * Frontend origins allowed to embed /hero-embed in an <iframe>.
 * ⬇⬇⬇  ADD YOUR PRODUCTION DOMAIN HERE WHEN YOU DEPLOY  ⬇⬇⬇
 */
function ams_afa_embed_origins() {
    return array(
        'http://localhost:3000',
        'https://ams-infotainment-frontend.vercel.app',
        // 'https://your-custom-domain.com',   // ← add your real domain when you have one
    );
}

/* ─────────────────────────── TV-show episodes ─────────────────────────────── */

add_action( 'rest_api_init', function () {
    register_rest_route( 'wp/v2/web', 'tv-show-episodes', array(
        'methods'             => 'GET',
        'callback'            => 'ams_afa_get_tv_show_episodes',
        'permission_callback' => '__return_true',
        'args'                => array(
            'tv_show' => array(
                'required'          => true,
                'validate_callback' => function ( $param ) {
                    return is_numeric( $param ) && (int) $param > 0;
                },
            ),
            'page_no'   => array( 'required' => false ),
            'page_size' => array( 'required' => false ),
        ),
    ) );
} );

function ams_afa_get_tv_show_episodes( $request ) {
    $tv_show_id = (int) $request->get_param( 'tv_show' );
    $page_no    = (int) $request->get_param( 'page_no' ) ?: 1;
    $page_size  = (int) $request->get_param( 'page_size' ) ?: 24;

    $query = new WP_Query( array(
        'post_type'      => 'episode',
        'post_status'    => 'publish',
        'posts_per_page' => $page_size,
        'paged'          => $page_no,
        'orderby'        => 'date',
        'order'          => 'DESC',
        'meta_query'     => array(
            array( 'key' => '_tv_show_id', 'value' => $tv_show_id ),
        ),
    ) );

    $data = array();
    foreach ( $query->posts as $post ) {
        $data[] = array(
            'id'             => $post->ID,
            'title'          => get_the_title( $post->ID ),
            'episode_number' => get_post_meta( $post->ID, '_episode_number', true ),
            // Index into the parent show's `_seasons` array, NOT an id. Editors
            // have left it wrong on plenty of episodes (obsok's "S2:E2" says 1),
            // so treat it as a hint, never as the ordering.
            'season_id'      => (int) get_post_meta( $post->ID, '_tv_show_season_id', true ),
            'permalink'      => get_permalink( $post->ID ),
            'post_thumbnail' => get_the_post_thumbnail_url( $post->ID, 'full' ),
            // Since 1.5.0 — what the live episode rows print. run_time is free
            // text ("02:01 នាទី") and hand-typed; release_date is Unix seconds
            // at MIDNIGHT PHNOM PENH TIME (format it in Asia/Phnom_Penh, or the
            // date prints a day early — the live theme's own bug).
            'run_time'       => trim( (string) get_post_meta( $post->ID, '_episode_run_time', true ) ),
            'release_date'   => (int) get_post_meta( $post->ID, '_episode_release_date', true ),
        );
    }

    return new WP_REST_Response( array(
        'status'     => 'OK',
        'data'       => $data,
        'page'       => $page_no,
        'per_page'   => $page_size,
        'total'      => (int) $query->found_posts,
        'total_page' => (int) $query->max_num_pages,
    ), 200 );
}

/* ─────────────────────────── Episode detail ───────────────────────────────── */

/**
 * The name of the season at $index of a show's `_seasons` meta, or ''.
 *
 * `_seasons` is a serialised array of { name, image_id, episodes[] } — the
 * episode's `_tv_show_season_id` is that array's INDEX, not an id. The name is
 * what the live page prints above its episode grid ("រដូវកាលទី១").
 */
function ams_afa_season_name( $tv_show_id, $index ) {
    $seasons = maybe_unserialize( get_post_meta( $tv_show_id, '_seasons', true ) );
    if ( ! is_array( $seasons ) || ! isset( $seasons[ $index ]['name'] ) ) {
        return '';
    }
    return (string) $seasons[ $index ]['name'];
}

/**
 * GET /wp-json/wp/v2/web/episode?id=<id>
 *
 * Everything the frontend's episode page needs and that WordPress will not hand
 * over: MasVideos keeps the video source, the run time, the release date and the
 * parent show in underscore-prefixed post meta, none of it registered with
 * `show_in_rest`, so `wp/v2/episode/<id>` answers `meta: []`.
 *
 * `video.choice` is MasVideos' `_episode_choice`. Every episode on the site today
 * is `episode_url` holding a `vimeo.com/<id>[/<unlisted-hash>]` link, but the
 * other two sources are real fields, so all three are returned rather than
 * guessed at here — the frontend picks.
 *
 * `release_date` is a Unix timestamp of MIDNIGHT PHNOM PENH TIME. Vodi formats it
 * in UTC and so prints every episode one day early; it is returned raw and the
 * frontend formats it in Asia/Phnom_Penh.
 */
add_action( 'rest_api_init', function () {
    register_rest_route( 'wp/v2/web', 'episode', array(
        'methods'             => 'GET',
        'callback'            => 'ams_afa_get_episode',
        'permission_callback' => '__return_true',
        'args'                => array(
            'id' => array(
                'required'          => true,
                'validate_callback' => function ( $param ) {
                    return is_numeric( $param ) && (int) $param > 0;
                },
            ),
        ),
    ) );
} );

function ams_afa_get_episode( $request ) {
    $id   = (int) $request->get_param( 'id' );
    $post = get_post( $id );

    if ( ! $post || 'episode' !== $post->post_type || 'publish' !== $post->post_status ) {
        return new WP_Error( 'ams_afa_not_found', 'No such published episode.', array( 'status' => 404 ) );
    }

    $meta = function ( $key ) use ( $id ) {
        return (string) get_post_meta( $id, $key, true );
    };

    $tv_show_id    = (int) $meta( '_tv_show_id' );
    $season_id     = (int) $meta( '_tv_show_season_id' );
    $attachment_id = (int) $meta( '_episode_attachment_id' );

    return new WP_REST_Response( array(
        'status' => 'OK',
        'data'   => array(
            'id'             => $id,
            'title'          => get_the_title( $id ),
            'episode_number' => $meta( '_episode_number' ),
            // Free text, and inconsistently typed: "02:01 នាទី", "02: 15នាទី".
            'run_time'       => trim( $meta( '_episode_run_time' ) ),
            'release_date'   => (int) $meta( '_episode_release_date' ),
            'tv_show_id'     => $tv_show_id,
            // The show's own title, which is what the live <h1> uses — not the
            // `movie` post's, which for some programs carries a longer name.
            'tv_show_title'  => $tv_show_id ? get_the_title( $tv_show_id ) : '',
            'season_id'      => $season_id,
            'season_name'    => $tv_show_id ? ams_afa_season_name( $tv_show_id, $season_id ) : '',
            'post_thumbnail' => (string) get_the_post_thumbnail_url( $id, 'full' ),
            'video'          => array(
                'choice'     => $meta( '_episode_choice' ),
                'url'        => $meta( '_episode_url_link' ),
                'attachment' => $attachment_id ? (string) wp_get_attachment_url( $attachment_id ) : '',
                'embed'      => $meta( '_episode_embed_content' ),
            ),
        ),
    ), 200 );
}

/* ───────────────────────── Program (movie / tv_show) ──────────────────────── */

/** An attachment as { url, width, height }, or zeroes when there isn't one.
 *
 *  The dimensions are the point: editors do not reliably put a PORTRAIT poster in
 *  the featured-image slot. vanna-yeatra's tv_show carries 2560x398 landscape key
 *  art there. Handing the frontend the size lets it tell a poster from a backdrop
 *  by shape instead of trusting which field the image was filed under. */
function ams_afa_image( $attachment_id ) {
    $attachment_id = (int) $attachment_id;
    $empty         = array( 'url' => '', 'width' => 0, 'height' => 0 );

    if ( ! $attachment_id ) {
        return $empty;
    }
    $src = wp_get_attachment_image_src( $attachment_id, 'full' );

    return $src ? array( 'url' => (string) $src[0], 'width' => (int) $src[1], 'height' => (int) $src[2] ) : $empty;
}

/**
 * GET /wp-json/wp/v2/web/program?id=<id>
 *
 * A program's title, description, poster and BACKDROP. Replaces the frontend's
 * old core-REST call (`wp/v2/movie/<id>?_fields=…&_embed=wp:featuredmedia`), which
 * could reach the first three but never the backdrop: Vodi keeps it in
 * `_vodi_<post_type>_bg_image`, and core REST answers `meta: []`.
 *
 * Works for both post types the program registry uses — most programs are a
 * `movie`, vanna-yeatra is a `tv_show`.
 */
add_action( 'rest_api_init', function () {
    register_rest_route( 'wp/v2/web', 'program', array(
        'methods'             => 'GET',
        'callback'            => 'ams_afa_get_program',
        'permission_callback' => '__return_true',
        'args'                => array(
            'id' => array(
                'required'          => true,
                'validate_callback' => function ( $param ) {
                    return is_numeric( $param ) && (int) $param > 0;
                },
            ),
        ),
    ) );
} );

function ams_afa_get_program( $request ) {
    $id   = (int) $request->get_param( 'id' );
    $post = get_post( $id );

    if ( ! $post || ! in_array( $post->post_type, array( 'movie', 'tv_show' ), true ) || 'publish' !== $post->post_status ) {
        return new WP_Error( 'ams_afa_not_found', 'No such published program.', array( 'status' => 404 ) );
    }

    // MasVideos prefixes its meta with the post type: `_movie_run_time`,
    // `_tv_show_run_time`, and so on. `_cast` / `_crew` are NOT prefixed.
    $p = '_' . $post->post_type;

    // `_vodi_movie_bg_image` / `_vodi_tv_show_bg_image` — the wide key art behind
    // the program's hero. Empty on plenty of posts; the frontend falls back.
    $backdrop_id = get_post_meta( $id, '_vodi_' . $post->post_type . '_bg_image', true );

    return new WP_REST_Response( array(
        'status' => 'OK',
        'data'   => array(
            'id'          => $id,
            'slug'        => $post->post_name,
            'title'       => get_the_title( $id ),
            'description' => apply_filters( 'the_excerpt', get_the_excerpt( $id ) ),
            'permalink'   => get_permalink( $id ),
            'poster'      => ams_afa_image( get_post_thumbnail_id( $id ) ),
            'backdrop'    => ams_afa_image( $backdrop_id ),
            // Unix seconds at MIDNIGHT PHNOM PENH TIME. Format it in Asia/Phnom_Penh
            // — in UTC it lands on the previous day, and on a New Year's release
            // that means the wrong YEAR, which is the only part we show.
            'release_date' => (int) get_post_meta( $id, $p . '_release_date', true ),
            // Named `run_time`, but it is NOT a duration: editors put the broadcast
            // slot in it ("រៀងរាល់ថ្ងៃអាទិត្យ វេលាម៉ោង ៨:៣០ នាទីព្រឹក"). Never render
            // it as a length. Set on 16 of the 19 programs.
            //
            // NOT RETURNED: cast/crew. MasVideos has `_cast` and `_crew` fields and
            // the Vodi single-movie template prints them ("ផលិតករៈ …"), but on this
            // site they are an empty string on every one of the 19 programs — the
            // fields have never been used. Populate them in WP admin first, then add
            // them here; resolving a shape nobody has ever stored is guesswork.
            'schedule'     => trim( (string) get_post_meta( $id, $p . '_run_time', true ) ),
        ),
    ), 200 );
}

/* ─────────────────── Homepage featured program ────────────────────────────── */

/**
 * The wide video banner on the frontend's homepage (វនយាត្រា today).
 *
 * WHY AN OPTION AND NOT JUST THE MOVIE POST: the Vodi block that renders this on
 * the WordPress homepage — `wp:vodi/section-featured-movie` — stores the movie id
 * AND the banner art TOGETHER, per placement:
 *
 *   {"movie_id":"20275","bg_image":19925,"className":"vanayeatra"}
 *
 * and the art it points at is NOT the movie's own `_vodi_movie_bg_image`. On
 * vanna-yeatra those are two different files — 19925 (2560x576) on the homepage,
 * 20277 (2560x398) on the movie — same scene, different crop. Which one suits a
 * given slot is a layout decision, so the slot owns its artwork, like the block.
 *
 * Both crops carry the show's WORDMARK in the pixels, and so does every other
 * variant in the media library. That is by design: the frontend prints only a
 * small title label and lets the artwork carry the logo. Don't go looking for a
 * "no text" version to pick — there isn't a meaningful one.
 *
 * Everything else (title, description, poster, release year, trailer) is read
 * live from the chosen movie post.
 *
 * NOTE: this is the plugin's one and only option. Deleting the plugin leaves it
 * behind; `delete_option( 'ams_afa_featured_program' )` if you want it gone.
 */
define( 'AMS_AFA_FEATURED_OPTION', 'ams_afa_featured_program' );

function ams_afa_featured_config() {
    $opt = get_option( AMS_AFA_FEATURED_OPTION, array() );
    return array(
        'movie_id' => isset( $opt['movie_id'] ) ? (int) $opt['movie_id'] : 0,
        'bg_image' => isset( $opt['bg_image'] ) ? (int) $opt['bg_image'] : 0,
    );
}

/* --- Settings screen (Settings → Featured Program) --- */

add_action( 'admin_menu', function () {
    add_options_page(
        'Homepage Featured Program',
        'Featured Program',
        'manage_options',
        'ams-afa-featured',
        'ams_afa_featured_settings_page'
    );
} );

add_action( 'admin_init', function () {
    register_setting( 'ams_afa_featured', AMS_AFA_FEATURED_OPTION, array(
        'type'              => 'array',
        'sanitize_callback' => 'ams_afa_sanitize_featured',
        'default'           => array(),
    ) );
} );

function ams_afa_sanitize_featured( $input ) {
    return array(
        'movie_id' => isset( $input['movie_id'] ) ? absint( $input['movie_id'] ) : 0,
        'bg_image' => isset( $input['bg_image'] ) ? absint( $input['bg_image'] ) : 0,
    );
}

// The media picker needs wp.media, and only on our screen.
add_action( 'admin_enqueue_scripts', function ( $hook ) {
    if ( 'settings_page_ams-afa-featured' === $hook ) {
        wp_enqueue_media();
    }
} );

function ams_afa_featured_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    $cfg    = ams_afa_featured_config();
    $movies = get_posts( array(
        'post_type'   => 'movie',
        'post_status' => 'publish',
        'numberposts' => -1,
        'orderby'     => 'title',
        'order'       => 'ASC',
    ) );
    $preview = $cfg['bg_image'] ? wp_get_attachment_image_url( $cfg['bg_image'], 'medium' ) : '';
    ?>
    <div class="wrap">
        <h1>Homepage Featured Program</h1>
        <p>
            Drives the wide video banner on the Next.js frontend
            (<code>GET /wp-json/wp/v2/web/featured-program</code>). Changes go live
            within an hour, or immediately if you ping the frontend's
            <code>/api/revalidate?tag=featured-program</code>.
        </p>
        <form method="post" action="options.php">
            <?php settings_fields( 'ams_afa_featured' ); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="ams-afa-movie">Program</label></th>
                    <td>
                        <select id="ams-afa-movie" name="<?php echo esc_attr( AMS_AFA_FEATURED_OPTION ); ?>[movie_id]">
                            <option value="0">— none (banner hidden) —</option>
                            <?php foreach ( $movies as $m ) : ?>
                                <option value="<?php echo esc_attr( $m->ID ); ?>" <?php selected( $cfg['movie_id'], $m->ID ); ?>>
                                    <?php echo esc_html( get_the_title( $m ) . '  (#' . $m->ID . ')' ); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <p class="description">
                            Title, description, poster, release year and the ▶ trailer are all read
                            from this post — edit them on the movie itself, not here.
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Banner art</th>
                    <td>
                        <input type="hidden" id="ams-afa-bg"
                               name="<?php echo esc_attr( AMS_AFA_FEATURED_OPTION ); ?>[bg_image]"
                               value="<?php echo esc_attr( $cfg['bg_image'] ); ?>" />
                        <div id="ams-afa-bg-preview" style="margin-bottom:8px;">
                            <?php if ( $preview ) : ?>
                                <img src="<?php echo esc_url( $preview ); ?>"
                                     style="max-width:420px;height:auto;border:1px solid #ccd0d4;" />
                            <?php endif; ?>
                        </div>
                        <button type="button" class="button" id="ams-afa-bg-pick">Choose image</button>
                        <button type="button" class="button" id="ams-afa-bg-clear">Clear</button>
                        <p class="description">
                            A wide crop — the live homepage uses 2560&times;576
                            (<code>01_VANNA_YEATRA_COVER_4447px X 1000px_OCT 11</code>). The artwork
                            is expected to carry the show's wordmark; the frontend prints only a
                            small title label beside it. Cropping matters more than anything else
                            here: a short banner gets letterboxed, a tall one gets cropped.
                        </p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <script>
    ( function ( $ ) {
        var frame;
        $( '#ams-afa-bg-pick' ).on( 'click', function ( e ) {
            e.preventDefault();
            if ( frame ) { frame.open(); return; }
            frame = wp.media( {
                title: 'Select banner art',
                button: { text: 'Use this image' },
                library: { type: 'image' },
                multiple: false
            } );
            frame.on( 'select', function () {
                var a = frame.state().get( 'selection' ).first().toJSON();
                var src = ( a.sizes && a.sizes.medium ) ? a.sizes.medium.url : a.url;
                $( '#ams-afa-bg' ).val( a.id );
                $( '#ams-afa-bg-preview' ).html(
                    $( '<img>' ).attr( 'src', src ).attr( 'style', 'max-width:420px;height:auto;border:1px solid #ccd0d4;' )
                );
            } );
            frame.open();
        } );
        $( '#ams-afa-bg-clear' ).on( 'click', function ( e ) {
            e.preventDefault();
            $( '#ams-afa-bg' ).val( '' );
            $( '#ams-afa-bg-preview' ).empty();
        } );
    } )( jQuery );
    </script>
    <?php
}

/* --- GET/POST /wp-json/wp/v2/web/featured-program --- */

/* ─────────────────────────── Roles (dashboard Role Management) ────────────── */

add_action( 'rest_api_init', function () {
    register_rest_route( 'wp/v2/web', 'roles', array(
        'methods'             => 'GET',
        'callback'            => 'ams_afa_get_roles',
        // Same gate as the dashboard's Users screen: the role/permission
        // layout is user-administration information. Runs as the X-AMS-Token
        // user via the determine_current_user filter below.
        'permission_callback' => function () {
            return current_user_can( 'list_users' );
        },
    ) );
} );

/**
 * GET /wp-json/wp/v2/web/roles — every role: display name, GRANTED capability
 * list (explicitly-false caps are dropped), and how many users hold the role.
 * Read-only by design — the dashboard screen is a viewer, not a role editor.
 *
 * NOTE: this reports the capabilities STORED on each role. Runtime grants are
 * not simulated — in particular this plugin's own user_has_cap filter (1.7.2)
 * answers _movie(s)/_tv_show(s)/_episode(s) checks dynamically, so a role can
 * hold program powers beyond what its stored list shows.
 */
function ams_afa_get_roles() {
    $counts = count_users();
    $avail  = isset( $counts['avail_roles'] ) ? (array) $counts['avail_roles'] : array();

    $data = array();
    foreach ( wp_roles()->roles as $slug => $role ) {
        $caps = array();
        foreach ( (array) ( isset( $role['capabilities'] ) ? $role['capabilities'] : array() ) as $cap => $granted ) {
            if ( $granted ) {
                $caps[] = (string) $cap;
            }
        }
        sort( $caps );
        $data[] = array(
            'slug'       => (string) $slug,
            'name'       => translate_user_role( $role['name'] ),
            'user_count' => isset( $avail[ $slug ] ) ? (int) $avail[ $slug ] : 0,
            'caps'       => $caps,
        );
    }

    return new WP_REST_Response( array( 'status' => 'OK', 'data' => $data ), 200 );
}

add_action( 'rest_api_init', function () {
    register_rest_route( 'wp/v2/web', 'featured-program', array(
        array(
            'methods'             => 'GET',
            'callback'            => 'ams_afa_get_featured_program',
            'permission_callback' => '__return_true',
        ),
        // Since 1.7.4: lets the dashboard's Settings screen set the banner
        // (same gate as the wp-admin page). Runs as the X-AMS-Token user.
        array(
            'methods'             => 'POST',
            'callback'            => 'ams_afa_set_featured_program',
            'permission_callback' => function () {
                return current_user_can( 'manage_options' );
            },
        ),
    ) );
} );

/**
 * Body: { movie_id: int, bg_image: int } — 0s allowed (0 movie hides the
 * banner; 0 bg falls back to the movie's own backdrop). A non-zero movie_id
 * must be a published movie; bg_image, when set, must be an attachment. On
 * success the frontend's `featured-program` cache tag is pinged through the
 * same webhook the publish hook uses, so the homepage refreshes immediately.
 */
function ams_afa_set_featured_program( WP_REST_Request $req ) {
    $movie_id = absint( $req->get_param( 'movie_id' ) );
    $bg_image = absint( $req->get_param( 'bg_image' ) );

    if ( $movie_id ) {
        $post = get_post( $movie_id );
        if ( ! $post || 'movie' !== $post->post_type || 'publish' !== $post->post_status ) {
            return new WP_REST_Response( array( 'status' => 'ERROR', 'message' => 'movie_id is not a published movie' ), 400 );
        }
    }
    if ( $bg_image && 'attachment' !== get_post_type( $bg_image ) ) {
        return new WP_REST_Response( array( 'status' => 'ERROR', 'message' => 'bg_image is not a media attachment' ), 400 );
    }

    update_option( AMS_AFA_FEATURED_OPTION, array( 'movie_id' => $movie_id, 'bg_image' => $bg_image ) );
    ams_afa_ping_revalidate( array( 'featured-program' ) );

    return new WP_REST_Response( array( 'status' => 'OK', 'data' => ams_afa_featured_config() ), 200 );
}

function ams_afa_get_featured_program() {
    $cfg  = ams_afa_featured_config();
    $id   = $cfg['movie_id'];
    $post = $id ? get_post( $id ) : null;

    // Nothing configured, or configured against a post that has since been
    // unpublished or deleted. Answer 200 with data:null rather than 404 — the
    // banner is decoration, and the frontend just skips rendering it.
    if ( ! $post || 'movie' !== $post->post_type || 'publish' !== $post->post_status ) {
        return new WP_REST_Response( array( 'status' => 'OK', 'data' => null ), 200 );
    }

    $meta = function ( $key ) use ( $id ) {
        return (string) get_post_meta( $id, $key, true );
    };

    // The slot's own artwork. Only if it has none do we fall back to the movie's
    // Vodi field — see the long note above on why that is a last resort.
    $bg_id         = $cfg['bg_image'] ?: (int) $meta( '_vodi_movie_bg_image' );
    $attachment_id = (int) $meta( '_movie_attachment_id' );

    return new WP_REST_Response( array(
        'status' => 'OK',
        'data'   => array(
            'id'           => $id,
            // The slot's RAW override id (0 = falling back to the movie's own
            // backdrop) — the dashboard's Settings screen needs it to save
            // without silently clearing an existing override. `cover` below
            // stays the resolved URL for the public banner.
            'bg_image_id'  => (int) $cfg['bg_image'],
            'slug'         => $post->post_name,
            'title'        => get_the_title( $id ),
            // Gutenberg HTML, same shape as core's excerpt.rendered.
            'description'  => apply_filters( 'the_excerpt', get_the_excerpt( $id ) ),
            'permalink'    => get_permalink( $id ),
            // PORTRAIT poster (~346x600) — NOT interchangeable with `cover`.
            'poster'       => (string) get_the_post_thumbnail_url( $id, 'full' ),
            'cover'        => $bg_id ? (string) wp_get_attachment_image_url( $bg_id, 'full' ) : '',
            // Unix seconds at MIDNIGHT PHNOM PENH TIME — same trap as episodes:
            // format it in Asia/Phnom_Penh, or you print the wrong day (and, on a
            // New Year's release, the wrong year).
            'release_date' => (int) $meta( '_movie_release_date' ),
            // NOT a duration, despite the meta key. Editors put the broadcast
            // schedule in here ("រៀងរាល់ថ្ងៃអាទិត្យ វេលាម៉ោង ៨:៣០ នាទីព្រឹក").
            // Passed through as-is; never render it as a run time.
            'schedule'     => trim( $meta( '_movie_run_time' ) ),
            // Movies point at their show with `_khi_tv_show_id`; EPISODES use
            // `_tv_show_id`. Different keys, same idea — don't mix them up.
            'tv_show_id'   => (int) $meta( '_khi_tv_show_id' ),
            'video'        => array(
                'choice'     => $meta( '_movie_choice' ),
                'url'        => $meta( '_movie_url_link' ),
                'attachment' => $attachment_id ? (string) wp_get_attachment_url( $attachment_id ) : '',
                // ⚠ GOES STALE. On vanna-yeatra this holds an OLDER Vimeo id than
                // `url` does. WordPress never shows it (`choice` is `movie_url`, so
                // Vodi renders `url` through oEmbed), which is why nobody noticed.
                // Consumers must prefer `url` and only fall back to this when it is
                // empty — the frontend's src/lib/api/video.ts does exactly that.
                'embed'      => $meta( '_movie_embed_content' ),
            ),
        ),
    ), 200 );
}

/* ──────────────── Publish → frontend cache webhook (since 1.7.3) ───────────── */

/**
 * Tells the Next.js frontend the moment content changes, so its ISR caches
 * revalidate on demand instead of on a timer (which lets the frontend run LONG
 * revalidate windows without going stale — the fix for the Vercel ISR-writes
 * budget). Fires on any save where the post is, or was, published (covers
 * publish, edit-while-published, unpublish and trash) for the types the
 * frontend renders, and sends the frontend's cache tags for exactly the pages
 * the change touches:
 *
 *   post              → articles, home, daily-events, article:<slug>,
 *                       category:<slug> (each of its categories)
 *   episode           → episodes, tv-show:<its show id>
 *   movie / tv_show   → program
 *
 * Configure it in Settings → Frontend Cache (webhook URL + shared secret; the
 * secret must equal the frontend's REVALIDATE_SECRET env). Unconfigured = the
 * hook no-ops, so the plugin stays safe to deploy anywhere. The request is
 * fire-and-forget (non-blocking, 2s cap) — publishing never waits on Vercel.
 */
define( 'AMS_AFA_REVALIDATE_OPTION', 'ams_afa_revalidate' );

function ams_afa_revalidate_config() {
    $opt = get_option( AMS_AFA_REVALIDATE_OPTION, array() );
    return array(
        'url'    => isset( $opt['url'] ) ? (string) $opt['url'] : '',
        'secret' => isset( $opt['secret'] ) ? (string) $opt['secret'] : '',
    );
}

/** The frontend cache tags a change to this post invalidates. */
function ams_afa_revalidate_tags( $post ) {
    switch ( $post->post_type ) {
        case 'post':
            $tags = array( 'articles', 'home', 'daily-events', 'article:' . $post->post_name );
            $terms = get_the_terms( $post, 'category' );
            if ( is_array( $terms ) ) {
                foreach ( $terms as $t ) {
                    // RAW slug on purpose — the frontend normalizes both sides
                    // through safeTag(), so over-long Khmer slugs still match.
                    $tags[] = 'category:' . rawurldecode( $t->slug );
                }
            }
            return $tags;
        case 'episode':
            $show = (int) get_post_meta( $post->ID, '_tv_show_id', true );
            return $show ? array( 'episodes', 'tv-show:' . $show ) : array( 'episodes' );
        case 'movie':
        case 'tv_show':
            // The frontend keys program pages by ITS OWN registry slugs, which
            // WordPress cannot know — the blanket tag (≈43 pages) is correct.
            return array( 'program' );
        default:
            return array();
    }
}

/** Fire-and-forget ping to the frontend's /api/revalidate with these tags.
 *  No-ops when the webhook isn't configured. */
function ams_afa_ping_revalidate( $tags ) {
    $cfg = ams_afa_revalidate_config();
    if ( ! $cfg['url'] || ! $cfg['secret'] || ! $tags ) {
        return;
    }
    // Repeated ?tag= params (the route reads getAll("tag")); add_query_arg
    // can't repeat a key, so the query string is built by hand.
    $query = 'secret=' . rawurlencode( $cfg['secret'] );
    foreach ( $tags as $tag ) {
        $query .= '&tag=' . rawurlencode( $tag );
    }
    wp_remote_post( $cfg['url'] . '?' . $query, array(
        'blocking'  => false,
        'timeout'   => 2,
        'sslverify' => true,
    ) );
}

add_action( 'transition_post_status', function ( $new_status, $old_status, $post ) {
    if ( 'publish' !== $new_status && 'publish' !== $old_status ) {
        return; // draft shuffling — nothing public changed
    }
    if ( ! in_array( $post->post_type, array( 'post', 'episode', 'movie', 'tv_show' ), true ) ) {
        return;
    }
    ams_afa_ping_revalidate( ams_afa_revalidate_tags( $post ) );
}, 10, 3 );

/* --- AMS Cache: skip its synchronous page WARMER on our writes (1.9.0) --- */

/**
 * Measured 2026-08-10 with docs/wordpress/ams-write-probe, per callback:
 *
 *   REST create (draft, full stack, 62 plugins)        715 ms
 *   wp_delete_post                                  97,086 ms
 *     of which scm_delete_post (ams-cache)           96,673 ms  = 99.6%
 *
 * ams-cache purges the affected URL and then calls scm_preload_critical_urls(),
 * which re-warms the homepage and archives by FETCHING THEM OVER HTTP —
 * synchronously, inside the write request, every fetch a full WordPress render
 * through the theme and all 62 plugins, competing for the same PHP-FPM pool as
 * the request waiting on it.
 *
 * That is the entire "saving took minutes, the dashboard reported failure, and
 * the row appeared anyway" complaint. The write had finished in under a second;
 * the request was waiting on the crawl. Aborting the fetch never cancelled it.
 *
 * It fires on publish, unpublish, save-of-a-published-post and permanent
 * delete. Draft saves are already free — scm_update_post returns early unless
 * post_status is 'publish', which is why a draft create measures 715 ms.
 *
 * WHY REMOVING IT IS SAFE, not merely faster:
 *   - The warmer fills a cache of WORDPRESS-RENDERED PAGES. The public site is
 *     the Next.js frontend now; the only WP-rendered pages a visitor still sees
 *     are /hero-embed and the Slider Revolution ad frames, and no article write
 *     invalidates either of those.
 *   - The frontend's own cache is refreshed by ams_afa_ping_revalidate() above,
 *     which is non-blocking with a 2s cap. That one stays.
 *   - PURGING is not the cost; warming is. And purge-without-warm is precisely
 *     what a cache is built to survive — the next visitor re-renders once.
 *
 * SCOPE: only requests carrying our header, so wp-admin keeps every bit of its
 * present behaviour, and no other plugin is touched or disabled.
 *
 * Header PRESENCE is the gate rather than a verified token, deliberately: this
 * changes cache warming, never authorization, and the write itself is still
 * gated by the REST capability check. Verifying would buy a user lookup on every
 * request to decide something that is not a permission.
 *
 * The response carries X-AMS-Cache-Preload so this is verifiable rather than
 * assumed — `skipped:4` is healthy. Fewer means ams-cache renamed a callback or
 * moved a priority, which would otherwise be a SILENT return to minute-long
 * writes, so it is written to the error log as well.
 */
add_action( 'rest_api_init', function () {
    if ( '' === ams_afa_request_token() ) {
        return;
    }

    $targets = array(
        'save_post'              => 'scm_update_post',
        'transition_post_status' => 'scm_update_post_status',
        'wp_trash_post'          => 'scm_purge_post_before_trash',
        'before_delete_post'     => 'scm_delete_post',
    );

    $removed = array();
    $missing = array();

    foreach ( $targets as $hook => $callback ) {
        // has_action() returns the PRIORITY, which can legitimately be 0 — hence
        // the strict comparison instead of a truthiness test.
        $priority = has_action( $hook, $callback );
        if ( false !== $priority ) {
            remove_action( $hook, $callback, $priority );
            $removed[] = $callback;
        } else {
            $missing[] = $hook . ':' . $callback;
        }
    }

    if ( $missing ) {
        error_log( '[ams-afa] ams-cache warmer NOT removed: ' . implode( ', ', $missing ) );
    }

    add_filter( 'rest_post_dispatch', function ( $response ) use ( $removed ) {
        if ( $response instanceof WP_REST_Response ) {
            $response->header( 'X-AMS-Cache-Preload', 'skipped:' . count( $removed ) );
        }
        return $response;
    }, 10, 1 );
}, 5 );

/* --- Settings screen (Settings → Frontend Cache) --- */

add_action( 'admin_menu', function () {
    add_options_page(
        'Frontend Cache Webhook',
        'Frontend Cache',
        'manage_options',
        'ams-afa-revalidate',
        'ams_afa_revalidate_settings_page'
    );
} );

add_action( 'admin_init', function () {
    register_setting( 'ams_afa_revalidate', AMS_AFA_REVALIDATE_OPTION, array(
        'type'              => 'array',
        'sanitize_callback' => 'ams_afa_sanitize_revalidate',
        'default'           => array(),
    ) );
} );

function ams_afa_sanitize_revalidate( $input ) {
    return array(
        'url'    => isset( $input['url'] ) ? esc_url_raw( trim( (string) $input['url'] ) ) : '',
        'secret' => isset( $input['secret'] ) ? trim( (string) $input['secret'] ) : '',
    );
}

function ams_afa_revalidate_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }
    $cfg = ams_afa_revalidate_config();
    ?>
    <div class="wrap">
        <h1>Frontend Cache Webhook</h1>
        <p>
            When a post, episode or program is published (or updated/unpublished), the
            plugin pings the Next.js frontend so the affected pages refresh immediately.
            Leave the URL empty to disable.
        </p>
        <form method="post" action="options.php">
            <?php settings_fields( 'ams_afa_revalidate' ); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="ams-afa-reval-url">Webhook URL</label></th>
                    <td>
                        <input type="url" id="ams-afa-reval-url" class="regular-text" style="width:480px"
                               name="<?php echo esc_attr( AMS_AFA_REVALIDATE_OPTION ); ?>[url]"
                               value="<?php echo esc_attr( $cfg['url'] ); ?>"
                               placeholder="https://info.amscloud.cc/api/revalidate" />
                        <p class="description">The frontend's <code>/api/revalidate</code> route.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="ams-afa-reval-secret">Shared secret</label></th>
                    <td>
                        <input type="password" id="ams-afa-reval-secret" class="regular-text" autocomplete="off"
                               name="<?php echo esc_attr( AMS_AFA_REVALIDATE_OPTION ); ?>[secret]"
                               value="<?php echo esc_attr( $cfg['secret'] ); ?>" />
                        <p class="description">
                            Must equal the frontend's <code>REVALIDATE_SECRET</code> environment
                            variable (Dokploy → the app → Environment).
                        </p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

/* ─────────── Program custom meta → REST  (movie / tv_show / episode) ───────── */

/**
 * Expose the CURATED set of program meta the dashboard editor needs.
 *
 * These keys hold a program's real data but start with `_`, so WordPress treats
 * them as protected and core REST won't show or accept them — `wp/v2/movie/<id>`
 * returns `meta: []`. register_post_meta with show_in_rest lifts that, and the
 * auth_callback (edit-capability on the post) is what makes a PROTECTED key
 * writable over REST rather than read-only.
 *
 * Scope is deliberately the trimmed editor set only (see the frontend's Program
 * editor): title/description/poster ride on core fields and are NOT here; the
 * `_seasons` repeater, trailer, buy-ticket and IMDb/TMDb fields are intentionally
 * left hidden. Keys mirror exactly what this plugin's own web/program and
 * web/episode endpoints already read, so nothing new is invented.
 *
 * NOTE: MasVideos never registered these for REST (that's why meta was empty), so
 * this is the first and only registration — no conflict. If a future theme update
 * starts registering one of them differently, WordPress will warn; adjust here.
 */
function ams_afa_register_program_meta() {
    // Protected meta is writable over REST only if an auth_callback allows it.
    // edit_post maps to the post type's edit capability (edit_movies, …).
    $auth = function ( $allowed, $meta_key, $post_id ) {
        return current_user_can( 'edit_post', $post_id );
    };
    $reg = function ( $post_type, $key, $type ) use ( $auth ) {
        register_post_meta( $post_type, $key, array(
            'single'        => true,
            'type'          => $type,
            'show_in_rest'  => true,
            'auth_callback' => $auth,
        ) );
    };

    // movie — most programs are this type
    $reg( 'movie', '_movie_choice',        'string' );  // video source: movie_url | movie_file | movie_embed
    $reg( 'movie', '_movie_url_link',      'string' );  // Vimeo/YouTube/MP4 URL (prefer over embed — see landmine)
    $reg( 'movie', '_movie_embed_content', 'string' );
    $reg( 'movie', '_movie_attachment_id', 'integer' ); // uploaded-file source
    $reg( 'movie', '_movie_release_date',  'integer' ); // Unix seconds, midnight Asia/Phnom_Penh
    $reg( 'movie', '_movie_run_time',      'string' );  // BROADCAST SCHEDULE text, not a duration
    $reg( 'movie', '_vodi_movie_bg_image', 'integer' ); // backdrop attachment id
    $reg( 'movie', '_khi_tv_show_id',      'integer' ); // links a movie-program to its show

    // tv_show — the one program (vanna-yeatra) that is a show, not a movie
    $reg( 'tv_show', '_tv_show_release_date',  'integer' );
    $reg( 'tv_show', '_tv_show_run_time',      'string' );
    $reg( 'tv_show', '_vodi_tv_show_bg_image', 'integer' );

    // episode — its own video + numbering + parent-show links
    $reg( 'episode', '_episode_number',        'string' );  // single source of truth for ordering
    $reg( 'episode', '_episode_choice',        'string' );
    $reg( 'episode', '_episode_url_link',      'string' );
    $reg( 'episode', '_episode_embed_content', 'string' );
    $reg( 'episode', '_episode_attachment_id', 'integer' );
    $reg( 'episode', '_episode_release_date',  'integer' );
    $reg( 'episode', '_episode_run_time',      'string' );
    $reg( 'episode', '_tv_show_id',            'integer' ); // parent show
    $reg( 'episode', '_tv_show_season_id',     'integer' ); // index into _seasons (editors leave it wrong — hint only)
}
add_action( 'init', 'ams_afa_register_program_meta' );

/* ─────────────── Menu-item ICON meta → REST  (nav_menu_item) ──────────────── */

/**
 * Make the program-icon strip's icons WRITABLE over core REST (1.7.6).
 *
 * The icons on WordPress's "AMS Infotainment Third Menu" are added by a
 * menu-image plugin that never registered its meta for REST, so
 * `/wp/v2/menu-items/<id>` answered `meta: {}` and refused any write — the
 * dashboard's Menus screen could show an icon but not change one.
 *
 * WHERE THE ICON ACTUALLY LIVES, measured on live 2026-08-06 (do not guess
 * this — the obvious-looking key is a decoy): the plugin stores it in
 * **`_thumbnail_id`**, i.e. as the menu item's FEATURED IMAGE, a core key
 * outside the `_menu_item_*` namespace entirely. `_menu_item_icon` also exists
 * on every row and is always EMPTY — it is the icon-CLASS field.
 *
 * WHY edit_theme_options RATHER THAN edit_post: menus are a theme surface in
 * core (which is why /wp/v2/menus and /wp/v2/menu-items both 401 anonymously),
 * and a nav_menu_item is a post nobody "owns" in the editorial sense. This is
 * the same capability core itself requires to reach these routes at all, so it
 * grants nothing that the endpoint did not already gate on.
 *
 * SCOPE: registered against `nav_menu_item` ONLY. `_thumbnail_id` is the core
 * featured-image key — registering it unscoped would expose and open the
 * featured image of every post type on the site.
 *
 * The three companion keys are registered because an icon set on a NEWLY
 * created item needs them to render: `_menu_item_image_size` picks the
 * rendition (the public strip reads exactly this), while `_menu_item_image_type`
 * and `_menu_item_image_title_position` are what make the WordPress theme draw
 * the image rather than the label. Their values are not invented — they are
 * the ones every existing row already carries ('image' / 'hide').
 *
 * No conflict to worry about: the OPTIONS schema for menu-items showed
 * `meta.properties` EMPTY before this, so nothing else registers these keys.
 * If the menu-image plugin ever starts registering one, WordPress will warn.
 */
function ams_afa_register_menu_icon_meta() {
    $auth = function () {
        return current_user_can( 'edit_theme_options' );
    };

    // An icon must be a real attachment. A bare int would happily store a POST
    // id and render a broken image — the same confusion the fast path's
    // pub-menu avoids with an attachment JOIN. 0 clears the icon.
    register_post_meta( 'nav_menu_item', '_thumbnail_id', array(
        'single'            => true,
        'type'              => 'integer',
        'show_in_rest'      => true,
        'auth_callback'     => $auth,
        'sanitize_callback' => function ( $value ) {
            $id = absint( $value );
            return ( $id > 0 && 'attachment' === get_post_type( $id ) ) ? $id : 0;
        },
    ) );

    // Only a size WordPress actually knows, or 'full'. An unknown name would
    // silently fall back to the original — which on this menu means a
    // 2251x2250 JPEG in a 36px slot.
    register_post_meta( 'nav_menu_item', '_menu_item_image_size', array(
        'single'            => true,
        'type'              => 'string',
        'show_in_rest'      => true,
        'auth_callback'     => $auth,
        'sanitize_callback' => function ( $value ) {
            $value   = sanitize_text_field( (string) $value );
            $allowed = array_merge( array( 'full' ), get_intermediate_image_sizes() );
            return in_array( $value, $allowed, true ) ? $value : 'full';
        },
    ) );

    foreach ( array( '_menu_item_image_type', '_menu_item_image_title_position' ) as $key ) {
        register_post_meta( 'nav_menu_item', $key, array(
            'single'            => true,
            'type'              => 'string',
            'show_in_rest'      => true,
            'auth_callback'     => $auth,
            'sanitize_callback' => 'sanitize_text_field',
        ) );
    }
}
add_action( 'init', 'ams_afa_register_menu_icon_meta' );

/**
 * Program capabilities, answered at runtime via `user_has_cap` (since 1.7.2).
 *
 * MasVideos registers movie / tv_show / episode with their own capability set
 * (edit_movies, edit_others_movies, publish_tv_shows, …; `map_meta_cap` turns a
 * per-post check like `edit_post` on a published program someone else owns into
 * edit_published_movies + edit_others_movies), but this site's roles were never
 * granted all of it, so REST 403'd `?context=edit` on real programs. 1.7.1's
 * add_cap reconcile onto the Administrator role proved ineffective; answering
 * the capability check itself cannot miss, no matter how the caps are spelled
 * or mapped, and writes nothing to stored role state:
 *
 *   - Administrators pass EVERY program cap (anything ending in _movie(s) /
 *     _tv_show(s) / _episode(s), singular or plural).
 *   - Other roles pass the per-post variants (edit_others_*, edit_published_*,
 *     edit_private_*, delete_others_* …, read_private_*) of a BASE cap their
 *     role already stores. This site's Author role deliberately carries
 *     edit_movies / edit_tv_shows / edit_episodes (see /web/login caps), so
 *     program editors can open and save ANY program — but they do NOT inherit
 *     delete variants unless the role also stores delete_movies etc., and roles
 *     with no program caps gain nothing at all.
 */
function ams_afa_program_caps_filter( $allcaps, $caps, $args, $user ) {
    foreach ( $caps as $cap ) {
        if ( ! empty( $allcaps[ $cap ] ) ) {
            continue; // already allowed
        }
        if ( ! preg_match( '/_(movies?|tv_shows?|episodes?)$/', $cap ) ) {
            continue; // not a program cap
        }
        if ( in_array( 'administrator', (array) $user->roles, true ) ) {
            $allcaps[ $cap ] = true;
            continue;
        }
        // Derive the per-post variant from its base cap:
        //   edit_others_movies / edit_published_movies / edit_private_movies → edit_movies
        //   delete_others_movies / delete_published_movies / …              → delete_movies
        //   read_private_movies                                             → edit_movies
        if ( preg_match( '/^(edit|delete)_(?:others|published|private)_(movies?|tv_shows?|episodes?)$/', $cap, $m ) ) {
            $base = $m[1] . '_' . $m[2];
        } elseif ( preg_match( '/^read_private_(movies?|tv_shows?|episodes?)$/', $cap, $m ) ) {
            $base = 'edit_' . $m[1];
        } else {
            continue;
        }
        if ( ! empty( $allcaps[ $base ] ) ) {
            $allcaps[ $cap ] = true;
        }
    }
    return $allcaps;
}
add_filter( 'user_has_cap', 'ams_afa_program_caps_filter', 10, 4 );

// On deactivation, hand back exactly the caps 1.7.1's add_cap reconcile recorded
// as added, and drop its marker — so roles return to exactly how MasVideos left
// them (the runtime filter above needs no stored state at all).
register_deactivation_hook( __FILE__, function () {
    $added = get_option( 'ams_afa_program_caps_added', array() );
    $role  = get_role( 'administrator' );
    if ( $role && is_array( $added ) ) {
        foreach ( $added as $cap ) {
            $role->remove_cap( $cap );
        }
    }
    delete_option( 'ams_afa_program_caps_added' );
} );

/* ──────────── Per-user login token  (POST /web/login, GET /web/me) ─────────── */

/**
 * Lets dashboard staff sign in with the real WordPress username + password they
 * already use, without cookies, a JWT plugin, or any wp-config / .htaccess edit.
 *
 * HOW IT FITS TOGETHER
 *   1. Next.js server  POSTs { username, password } to  /web/login.
 *   2. We run it through wp_authenticate() — so every existing login protection
 *      (security plugins, blocked/spam users, the wp_login_failed hooks) still
 *      applies — and on success mint a short-lived signed token.
 *   3. Next.js keeps that token in an httpOnly cookie the browser can't read, and
 *      replays it on each write in an  X-AMS-Token:  header.
 *   4. The determine_current_user filter below verifies the token and sets the
 *      current user, so the write executes AS that person and WordPress enforces
 *      their capabilities exactly as it would in wp-admin.
 *
 * THE TOKEN  ( body ".", signature ), both base64url:
 *   body      = base64url( {"uid":<id>,"exp":<unix>,"v":1} )   — readable, signed
 *   signature = HMAC-SHA256( body, key )
 *   key       = HMAC-SHA256( "<id>|<4 chars of user_pass>", wp_salt('auth') )
 * Signing with wp_salt('auth') reuses a secret WordPress already has (no new
 * config). Folding in four characters of the stored password hash means a
 * password change rotates the key and instantly invalidates that user's tokens —
 * the same trick core uses for its own auth cookies. There is no server-side
 * token store, so "log out everywhere" == change password; ordinary logout is
 * just the Next.js server dropping the cookie.
 *
 * WHY A CUSTOM  X-AMS-Token  HEADER (not Authorization: Bearer): Apache/mod_php
 * commonly strips the Authorization header before PHP sees it. A custom header
 * sidesteps that entirely and never collides with core's own auth handling.
 *
 * These are the only writable defaults; edit a `define()` (or add one to
 * wp-config before the plugin loads) to change the TTL, throttle, etc.
 */
if ( ! defined( 'AMS_AFA_LOGIN_TTL' ) ) {
    define( 'AMS_AFA_LOGIN_TTL', 12 * HOUR_IN_SECONDS );      // token lifetime
}
if ( ! defined( 'AMS_AFA_LOGIN_HEADER' ) ) {
    define( 'AMS_AFA_LOGIN_HEADER', 'X-AMS-Token' );          // header carrying it
}
if ( ! defined( 'AMS_AFA_LOGIN_MAX_FAILS' ) ) {
    define( 'AMS_AFA_LOGIN_MAX_FAILS', 5 );                   // fails before lockout
}
if ( ! defined( 'AMS_AFA_LOGIN_LOCKOUT' ) ) {
    define( 'AMS_AFA_LOGIN_LOCKOUT', 15 * MINUTE_IN_SECONDS ); // lockout window
}
if ( ! defined( 'AMS_AFA_LOGIN_REQUIRE_SSL' ) ) {
    define( 'AMS_AFA_LOGIN_REQUIRE_SSL', true );               // refuse creds over http
}

/* --- token helpers --- */

function ams_afa_b64url_encode( $bin ) {
    return rtrim( strtr( base64_encode( $bin ), '+/', '-_' ), '=' );
}

function ams_afa_b64url_decode( $str ) {
    $b64 = strtr( (string) $str, '-_', '+/' );
    $pad = strlen( $b64 ) % 4;
    if ( $pad ) {
        $b64 .= str_repeat( '=', 4 - $pad );
    }
    return base64_decode( $b64, true );
}

/** Per-user signing key: wp_salt('auth') + a fragment of the password hash. */
function ams_afa_login_key( $user ) {
    $pass_frag = substr( (string) $user->user_pass, 8, 4 );
    return hash_hmac( 'sha256', $user->ID . '|' . $pass_frag, wp_salt( 'auth' ) );
}

function ams_afa_login_sign( $user, $exp ) {
    $body = ams_afa_b64url_encode( wp_json_encode( array(
        'uid' => (int) $user->ID,
        'exp' => (int) $exp,
        'v'   => 1,
    ) ) );
    $sig = hash_hmac( 'sha256', $body, ams_afa_login_key( $user ), true );
    return $body . '.' . ams_afa_b64url_encode( $sig );
}

/** Returns the user id a token authenticates, or 0 if it is invalid/expired. */
function ams_afa_login_verify( $token ) {
    if ( ! is_string( $token ) || substr_count( $token, '.' ) !== 1 ) {
        return 0;
    }
    list( $body, $sig_b64 ) = explode( '.', $token, 2 );

    $json = ams_afa_b64url_decode( $body );
    if ( false === $json ) {
        return 0;
    }
    $payload = json_decode( $json, true );
    if ( ! is_array( $payload ) || empty( $payload['uid'] ) || empty( $payload['exp'] ) ) {
        return 0;
    }
    if ( (int) $payload['exp'] < time() ) {
        return 0; // expired
    }

    $user = get_user_by( 'id', (int) $payload['uid'] );
    if ( ! $user ) {
        return 0;
    }

    $expected = hash_hmac( 'sha256', $body, ams_afa_login_key( $user ), true );
    $given    = ams_afa_b64url_decode( $sig_b64 );
    if ( false === $given || ! hash_equals( $expected, $given ) ) {
        return 0; // bad signature (or password since changed → key rotated)
    }
    return (int) $user->ID;
}

/** The header value, read from $_SERVER (works this early, outside REST too). */
function ams_afa_request_token() {
    $key = 'HTTP_' . strtoupper( str_replace( '-', '_', AMS_AFA_LOGIN_HEADER ) );
    return isset( $_SERVER[ $key ] ) ? trim( (string) wp_unslash( $_SERVER[ $key ] ) ) : '';
}

/* --- authenticate REST requests carrying the header --- */

/**
 * Priority 20 (same slot core uses for Application Passwords): after normal
 * cookie auth (10), so a genuine wp-admin session is never overridden. We touch
 * $user_id ONLY when nothing else resolved it AND our header is present — every
 * other request passes through untouched.
 */
add_filter( 'determine_current_user', function ( $user_id ) {
    if ( $user_id ) {
        return $user_id;
    }
    $token = ams_afa_request_token();
    if ( '' === $token ) {
        return $user_id;
    }
    $verified = ams_afa_login_verify( $token );
    return $verified ? $verified : $user_id;
}, 20 );

/* --- the { id, name, roles, capabilities } payload --- */

/**
 * The capabilities the dashboard actually gates on — a curated allow-list, not
 * WordPress's full ~60-cap surface. The frontend reads these booleans directly
 * (e.g. capabilities.list_users decides whether the Users nav item renders),
 * which replaces the hardcoded isAdmin in AdminSidebar.tsx. Add a key here the
 * day a screen needs to branch on it; there is no cost to the ones already
 * listed. Roles map (plan §4): Author cannot publish_posts; Contributor can;
 * manage_options is over-granted to Author/Contributor/Editor.
 */
function ams_afa_login_caps() {
    return array(
        // Posts / editorial
        'edit_posts', 'publish_posts', 'edit_published_posts',
        'edit_others_posts', 'delete_posts', 'delete_others_posts',
        'manage_categories',
        // Users
        'list_users', 'edit_users', 'promote_users',
        // Site
        'manage_options', 'upload_files',
        // MasVideos CPTs — programs (movie / tv_show / episode) and videos
        'edit_movies', 'publish_movies',
        'edit_tv_shows', 'publish_tv_shows',
        'edit_videos', 'publish_videos',
        'edit_episodes', 'publish_episodes',
    );
}

function ams_afa_login_user_payload( $user ) {
    $caps = array();
    foreach ( ams_afa_login_caps() as $cap ) {
        $caps[ $cap ] = user_can( $user, $cap );
    }
    return array(
        'id'           => (int) $user->ID,
        'name'         => $user->display_name,
        'username'     => $user->user_login,
        'roles'        => array_values( (array) $user->roles ),
        'capabilities' => $caps,
    );
}

/**
 * Gate: does this account have ANY reason to be in the dashboard? Blocks pure
 * Subscribers / Visitors / Translators (plan §4 "none") from getting a token at
 * all — cleaner than issuing one and showing them an empty shell. Relax by
 * editing the list if a read-only role should be allowed in later.
 */
function ams_afa_login_has_access( $user ) {
    $gate = array(
        'edit_posts', 'upload_files', 'manage_options', 'list_users',
        'edit_movies', 'edit_tv_shows', 'edit_videos', 'edit_episodes',
    );
    foreach ( $gate as $cap ) {
        if ( user_can( $user, $cap ) ) {
            return true;
        }
    }
    return false;
}

/* --- brute-force throttle (per client IP, transient-backed) --- */

function ams_afa_client_ip() {
    // REMOTE_ADDR only — X-Forwarded-For is caller-supplied and spoofable. If
    // this WordPress sits behind a proxy you control, resolve the real IP here.
    return isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
}

function ams_afa_login_throttle_key() {
    return 'ams_afa_login_fails_' . md5( ams_afa_client_ip() );
}

/** True over HTTPS, including behind an SSL-terminating proxy. */
function ams_afa_login_is_secure() {
    if ( is_ssl() ) {
        return true;
    }
    $proto = isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) ? strtolower( (string) $_SERVER['HTTP_X_FORWARDED_PROTO'] ) : '';
    return 'https' === $proto;
}

/* --- routes --- */

add_action( 'rest_api_init', function () {
    register_rest_route( 'wp/v2/web', 'login', array(
        'methods'             => 'POST',
        'callback'            => 'ams_afa_login',
        'permission_callback' => '__return_true',
        'args'                => array(
            'username' => array( 'required' => true, 'type' => 'string' ),
            'password' => array( 'required' => true, 'type' => 'string' ),
        ),
    ) );

    register_rest_route( 'wp/v2/web', 'me', array(
        'methods'             => 'GET',
        'callback'            => 'ams_afa_me',
        'permission_callback' => function () {
            return is_user_logged_in();
        },
    ) );
} );

function ams_afa_login( $request ) {
    if ( AMS_AFA_LOGIN_REQUIRE_SSL && ! ams_afa_login_is_secure() ) {
        return new WP_Error( 'ams_afa_insecure', 'Login requires HTTPS.', array( 'status' => 400 ) );
    }

    // Throttle first — a locked-out IP never reaches wp_authenticate().
    $throttle_key = ams_afa_login_throttle_key();
    $fails        = (int) get_transient( $throttle_key );
    if ( $fails >= AMS_AFA_LOGIN_MAX_FAILS ) {
        $resp = new WP_REST_Response( array(
            'status'  => 'error',
            'code'    => 'too_many_attempts',
            'message' => 'Too many failed attempts. Try again later.',
        ), 429 );
        $resp->header( 'Retry-After', (string) AMS_AFA_LOGIN_LOCKOUT );
        return $resp;
    }

    $username = trim( (string) $request->get_param( 'username' ) );
    $password = (string) $request->get_param( 'password' );
    if ( '' === $username || '' === $password ) {
        return new WP_Error( 'ams_afa_bad_request', 'Username and password are required.', array( 'status' => 400 ) );
    }

    $user = wp_authenticate( $username, $password );

    if ( is_wp_error( $user ) ) {
        // Count the failure; answer with ONE generic message so the response
        // never reveals whether the username exists.
        set_transient( $throttle_key, $fails + 1, AMS_AFA_LOGIN_LOCKOUT );
        return new WP_Error( 'ams_afa_invalid_login', 'Invalid username or password.', array( 'status' => 401 ) );
    }

    if ( ! ams_afa_login_has_access( $user ) ) {
        // Valid credentials, but nothing to do here. Don't count it as a brute-
        // force failure, but don't hand out a token either.
        return new WP_Error( 'ams_afa_no_access', 'This account has no dashboard access.', array( 'status' => 403 ) );
    }

    delete_transient( $throttle_key ); // clean slate on success

    $exp = time() + AMS_AFA_LOGIN_TTL;
    return new WP_REST_Response( array(
        'status'     => 'OK',
        'token'      => ams_afa_login_sign( $user, $exp ),
        'expires_at' => $exp,
        'user'       => ams_afa_login_user_payload( $user ),
    ), 200 );
}

function ams_afa_me() {
    return new WP_REST_Response( array(
        'status' => 'OK',
        'user'   => ams_afa_login_user_payload( wp_get_current_user() ),
    ), 200 );
}

/* ───────────────────── Anonymous REST comments ────────────────────────────── */

/**
 * Let `POST /wp-json/wp/v2/comments` accept anonymous comments.
 *
 * The site already accepts them — the theme's own form posts to
 * wp-comments-post.php with no login — but core REST refuses anonymous
 * creation unless this filter opts in. It changes WHO may use the REST route,
 * not what happens next: required fields, moderation and spam settings from
 * Settings → Discussion apply exactly as they do to the classic form.
 */
add_filter( 'rest_allow_anonymous_comments', '__return_true' );

/* ────────── Slider embeds  (GET /hero-embed, GET /sr-embed) ────────────────── */

/**
 * Resolve a caller-supplied alias to a slider that ACTUALLY EXISTS, or null.
 *
 * This is what lets /sr-embed accept aliases no human whitelisted, without
 * reopening the door the hero whitelist was closing. The rule there was "render
 * any shortcode argument a visitor sends" is unsafe — still true. The answer is
 * not a longer list (article sliders can't be hand-maintained), it is asking
 * Slider Revolution whether the alias names a real slider before rendering it.
 * Anything else 404s and never reaches do_shortcode().
 *
 * Case is PRESERVED, deliberately. sanitize_title() lowercases, and this site
 * has modules whose aliases differ only in case and suffix (INFHB010_01 next to
 * infhb010_01-1) — lowercasing turns one into a near-miss of the other. The
 * shape gate below allows exactly the characters SR puts in an alias.
 *
 * Returns the STORED alias, not the caller's spelling: the column collation is
 * case-insensitive, so the matched row may be spelled differently from the
 * input, and the shortcode wants the real one.
 */
function ams_afa_slider_alias( $raw ) {
    global $wpdb;

    $alias = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $raw );
    if ( $alias === '' || strlen( $alias ) > 191 ) {
        return null;
    }

    // Slider Revolution deactivated or never installed — nothing to render, and
    // the query below would fatal on a missing table.
    $table = $wpdb->prefix . 'revslider_sliders';
    if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) !== $table ) {
        return null;
    }

    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is $wpdb->prefix, not input.
    $found = $wpdb->get_var( $wpdb->prepare( "SELECT alias FROM {$table} WHERE alias = %s LIMIT 1", $alias ) );

    return ( $found === null || $found === '' ) ? null : (string) $found;
}

/**
 * Render ONE slider as a standalone page and exit.
 *
 * The whole reason the frontend can show Slider Revolution at all: wp_head() and
 * wp_footer() are what emit sr7.css, tptools.js, sr7.js, the _tpt bootstrap AND
 * the per-module SR7.JSON config. None of those live in post_content, which is
 * why the same markup pasted into the Next app renders as collapsed inline
 * elements — it has the slider's body and none of its runtime.
 */
function ams_afa_render_embed( $alias ) {
    // Let the whitelisted frontend origins iframe this page (override any
    // X-Frame-Options a security plugin may have set).
    header_remove( 'X-Frame-Options' );
    header( "Content-Security-Policy: frame-ancestors 'self' " . implode( ' ', ams_afa_embed_origins() ) );
    status_header( 200 );

    ?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <!-- A frame is not a page. Keep these out of the index so they never compete
         with the article or landing page that embeds them. -->
    <meta name="robots" content="noindex,nofollow">
    <style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;}</style>
    <?php wp_head(); ?>
</head>
<body <?php body_class( 'ams-hero-embed' ); ?>>
    <?php echo do_shortcode( '[rev_slider alias="' . esc_attr( $alias ) . '"]' ); ?>
    <?php wp_footer(); ?>
    <script>
    (function () {
        /**
         * The slider's height — measured from the MODULE, never the document.
         *
         * Slider Revolution injects <sr7-fonttest-wrap>, a 1000px-tall scratch
         * element it uses for font metrics. It is absolutely positioned, so it
         * never touches body.scrollHeight — but it DOES inflate
         * documentElement.scrollHeight, and the old Math.max() of the two took
         * the inflated number every time the real slider was shorter than
         * ~1300px. Measured live: the homepage hero is 650px and was reporting
         * 1322px, i.e. ~670px of dead space under the hero; a 150px article
         * banner reported 1322px too.
         *
         * offsetTop + offsetHeight rather than a bounding rect: this also runs
         * on an interval, and a rect is viewport-relative, so a scrolled frame
         * would measure short.
         */
        function measure() {
            var m = document.querySelector('sr7-module');
            if ( m && m.offsetHeight > 0 ) return m.offsetTop + m.offsetHeight;
            // No module (bad alias, or SR still booting): the body box is still
            // honest, because the fonttest wrap is out of flow.
            return document.body.scrollHeight;
        }
        /**
         * ONLY REPORT A HEIGHT SLIDER REVOLUTION HAS SETTLED ON.
         *
         * SR lays a module out more than once while booting: it picks a
         * breakpoint from whatever the frame measures at that instant, then
         * re-lays-out when things settle. Measured on the live article, every
         * module reported a transient 460px (SR's tablet layout) — and one
         * reported 5030px — before landing on its real height seconds later.
         * The parent applied each of those, so the page heaved up and down by
         * hundreds of pixels as the reader scrolled.
         *
         * The parent already reserves the module's declared geometry, and that
         * reservation is CORRECT — every module settles to exactly it. So the
         * cure is not faster updates, it is silence: send nothing until a value
         * has held for three consecutive samples, and the reservation carries
         * the layout until then. Zero shift, rather than fast-converging shift.
         */
        var STABLE_TICKS = 3;
        var lastSeen = -1, seenCount = 0, lastSent = -1;
        function post() {
            var h = measure();
            if ( h <= 0 ) return;
            if ( h === lastSeen ) { seenCount++; } else { lastSeen = h; seenCount = 1; }
            if ( seenCount < STABLE_TICKS || h === lastSent ) return;
            lastSent = h;
            // Two key names for one value. amsHeroHeight is what the deployed
            // HeroEmbed listens for and must keep working; amsEmbedHeight is the
            // name that isn't a lie when the frame holds an article slider. New
            // callers use the generic pair, and the hero can migrate later
            // without a flag day.
            parent.postMessage( { amsHeroHeight: h, amsEmbedHeight: h }, '*' );
        }
        window.addEventListener( 'load', post );
        // A real resize IS a new layout, so let the next value through quickly
        // rather than making it re-earn three ticks against the old one.
        window.addEventListener( 'resize', function () { lastSeen = -1; seenCount = 0; post(); } );
        // 200ms x 60 = 12s of watching. Denser than the old 400ms tick because
        // three samples now have to agree before anything is sent.
        var n = 0, t = setInterval( function () { post(); if ( ++n > 60 ) clearInterval( t ); }, 200 );

        /**
         * REPLAY ON RE-ENTRY.
         *
         * On WordPress a module resets its layers when it leaves the viewport
         * and plays its intro again on the way back — measured: opacity drops
         * to 0 while away, then staggers 0.02 -> 0.90 -> 1.0 on return. Framed,
         * that never happens: the module is permanently inside the frame's own
         * viewport, so SR sees no exit and no re-entry.
         *
         * Only the parent knows where the frame really is on the page, so the
         * parent owns this: it watches the frame and asks for a replay. Below is
         * the same lever SR's own viewport observer pulls — set inViewPort and
         * call the module's toggle, which routes to SR7.F.module.resume.
         *
         * Wrapped in try/catch on purpose. SR7.M / observParams are internals,
         * not public API, and the honest failure mode if a future release moves
         * them is "the animation stops replaying" — never a broken frame.
         */
        var AMS_PARENTS = <?php echo wp_json_encode( ams_afa_embed_origins() ); ?>;
        window.addEventListener( 'message', function ( e ) {
            if ( AMS_PARENTS.indexOf( e.origin ) === -1 ) return;
            if ( ! e.data || e.data.amsEmbedReplay !== true ) return;
            try {
                var el = document.querySelector( 'sr7-module' );
                if ( ! el || ! el.observParams || ! window.SR7 || ! SR7.M ) return;
                var M = SR7.M[ el.id ];
                if ( ! M || ! M.states ) return;
                M.states.inViewPort = true;
                el.observParams.toggleCall( el.id, null, M.c && M.c.slide );
            } catch ( err ) {}
        } );

        // Slide links are absolute WordPress URLs, and following one inside the
        // iframe navigates the visitor off the frontend entirely. Hand the click
        // to the parent instead; it maps the URL onto its own routes.
        document.addEventListener( 'click', function ( e ) {
            var a = e.target && e.target.closest ? e.target.closest( 'a[href]' ) : null;
            if ( ! a || window.parent === window ) {
                return;
            }
            e.preventDefault();
            parent.postMessage( { amsHeroNav: a.href, amsEmbedNav: a.href }, '*' );
        }, true );
    })();
    </script>
</body>
</html><?php
    exit;
}

add_action( 'template_redirect', function () {
    $path = trim( (string) wp_parse_url( $_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH ), '/' );

    /* ---- /hero-embed — UNCHANGED semantics ---------------------------------
       Whitelist, and an unknown alias falls back to the homepage slider. That
       fallback is correct for a hero (a landing page always wants *a* hero) and
       is load-bearing for every deployed frontend, so it stays exactly as it
       was. It is also precisely wrong for article content, which is why
       /sr-embed below is a separate route rather than a looser flag on this
       one: dropping the homepage hero into the middle of an article would be a
       worse failure than rendering nothing. */
    if ( $path === 'hero-embed' ) {
        $alias = isset( $_GET['alias'] ) ? sanitize_title( wp_unslash( $_GET['alias'] ) ) : '';
        if ( ! in_array( $alias, ams_afa_hero_aliases(), true ) ) {
            $alias = AMS_AFA_HERO_ALIAS;
        }
        ams_afa_render_embed( $alias );
    }

    /* ---- /sr-embed — any slider that exists, 404 otherwise ----------------- */
    if ( $path === 'sr-embed' ) {
        $alias = ams_afa_slider_alias( $_GET['alias'] ?? '' );
        if ( $alias === null ) {
            status_header( 404 );
            header( 'Content-Type: text/plain; charset=utf-8' );
            header( 'X-Robots-Tag: noindex' );
            echo 'Unknown slider alias.';
            exit;
        }
        ams_afa_render_embed( $alias );
    }
} );
