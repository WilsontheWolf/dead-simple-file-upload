const Koa = require('koa');
const Router = require('@koa/router');
const fs = require('fs/promises');
const multer = require('@koa/multer');

const app = new Koa();
const router = new Router();
const upload = multer();

const data = new Map();

const genCode = (length = 5) => {
    let characters = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};


router.get('/', async (ctx, next) => {
    ctx.body = await fs.readFile('./pages/index.html', 'utf8');
    ctx.type = 'text/html';
});

router.get('/index.css', async (ctx, next) => {
    ctx.body = await fs.readFile('./pages/index.css', 'utf8');
    ctx.type = 'text/css';
});

router.post('/upload', upload.single('file'),
    async ctx => {
        const file = ctx.file;
        const text = ctx.request.body?.text?.trim();
        if (!file && !text) {
            ctx.status = 400
            ctx.body = await fs.readFile('./pages/noContent.html', 'utf8');
            ctx.type = 'text/html';
            return;
        }
        let code = genCode();
        while (await data.has(code)) code = genCode();
        await data.set(code, {
            file: file,
            text: text
        });
        let host = ctx.req.headers.host;
        if (host) host = `http${ctx.req.secure ? 's' : ''}://${host}`;
        ctx.body = (await fs.readFile('./pages/success.html', 'utf8')).replaceAll('%url%', `${host || ''}/share/${code}`);
        ctx.type = 'text/html';

    }
);

router.get('/share/:code', async (ctx, next) => {
    const code = ctx.params.code;
    if (!await data.has(code)) {
        ctx.status = 404;
        ctx.body = await fs.readFile('./pages/notFound.html', 'utf8');
        ctx.type = 'text/html';
        return;
    }
    const { file, text } = await data.get(code);
    const content = `${file ? `<p><b>File:</b> <a href="/download/${code}">${file.originalname || 'Download'}</a></p>` : ''}${text ? `<p><b>Text:</b> <button id="copyButton">Copy</button> <pre id="textData">${text.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</pre></p>` : ''}`;
    ctx.body = (await fs.readFile('./pages/share.html', 'utf8')).replaceAll('%data%', content).replaceAll('%code%', code);
    ctx.type = 'text/html';
});

router.get('/download/:code', async (ctx, next) => {
    const code = ctx.params.code;
    if (!await data.has(code)) {
        ctx.status = 404;
        ctx.body = await fs.readFile('./pages/notFound.html', 'utf8');
        ctx.type = 'text/html';
        return;
    }
    const { file } = await data.get(code);
    if (!file) {
        ctx.status = 404;
        ctx.body = await fs.readFile('./pages/notFound.html', 'utf8');
        ctx.type = 'text/html';
        return;
    }
    ctx.attachment(file.originalname);
    ctx.type = file.mimetype;
    ctx.body = file.buffer;
});


app
    .use(router.routes())
    .use(router.allowedMethods())
    .use(async (ctx, next) => {
        if (ctx.status === 404) {
            ctx.body = await fs.readFile('./pages/notFound.html', 'utf8');
            ctx.type = 'text/html';
        }
    })
    .listen(3000);
