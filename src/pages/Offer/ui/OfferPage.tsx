import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLang } from '@app/providers/lang';
import './style.scss';

export function OfferPage() {
  const { lang } = useLang();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const currentDate = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <>
      <Helmet>
        <title>{lang === 'ru' ? 'Публичная оферта' : 'Public Offer'}</title>
        <meta
          name="description"
          content={
            lang === 'ru'
              ? 'Публичная оферта о заключении договора розничной купли-продажи товаров дистанционным способом'
              : 'Public offer for retail purchase and sale agreement via remote means'
          }
        />
      </Helmet>
      <div className="offer-page">
        <div className="offer-page__container">
          <h1 className="offer-page__title">
            {lang === 'ru' ? 'ПУБЛИЧНАЯ ОФЕРТА' : 'PUBLIC OFFER'}
          </h1>
          <p className="offer-page__subtitle">
            {lang === 'ru'
              ? 'о заключении договора розничной купли-продажи товаров дистанционным способом и предоставлении цифрового контента'
              : 'on the conclusion of a retail purchase and sale agreement via remote means and provision of digital content'}
          </p>

          <div className="offer-page__meta">
            <p>
              <strong>{lang === 'ru' ? 'Дата публикации:' : 'Publication date:'}</strong>{' '}
              {currentDate}
            </p>
            <p>
              <strong>{lang === 'ru' ? 'Сайт:' : 'Website:'}</strong> smolyanoechuchelko.ru
            </p>
          </div>

          <div className="offer-page__content">
            <p className="offer-page__intro">
              {lang === 'ru' ? (
                <>
                  Настоящий документ является публичной офертой в смысле ст. 435 и ст. 437
                  Гражданского кодекса РФ.
                </>
              ) : (
                <>
                  This document is a public offer within the meaning of Articles 435 and 437 of the
                  Civil Code of the Russian Federation.
                </>
              )}
            </p>

            <section className="offer-page__section">
              <h2 className="offer-page__section-title">
                {lang === 'ru' ? '1. Термины' : '1. Terms'}
              </h2>
              <dl className="offer-page__terms-list">
                <dt>
                  <strong>{lang === 'ru' ? 'Продавец' : 'Seller'}</strong>
                </dt>
                <dd>
                  {lang === 'ru'
                    ? '— самозанятое лицо, осуществляющее продажу товаров и цифрового контента через Сайт.'
                    : '— self-employed person selling goods and digital content through the Website.'}
                </dd>

                <dt>
                  <strong>{lang === 'ru' ? 'Покупатель' : 'Buyer'}</strong>
                </dt>
                <dd>
                  {lang === 'ru'
                    ? '— дееспособное лицо, оформившее Заказ на Сайте.'
                    : '— capable person who has placed an Order on the Website.'}
                </dd>

                <dt>
                  <strong>{lang === 'ru' ? 'Сайт' : 'Website'}</strong>
                </dt>
                <dd>
                  {lang === 'ru'
                    ? '— интернет-сайт Продавца по адресу smolyanoechuchelko.ru.'
                    : "— Seller's website at smolyanoechuchelko.ru."}
                </dd>

                <dt>
                  <strong>{lang === 'ru' ? 'Товар' : 'Product'}</strong>
                </dt>
                <dd>
                  {lang === 'ru'
                    ? '— материальный товар (мерч), предлагаемый к покупке на Сайте.'
                    : '— physical product (merchandise) offered for purchase on the Website.'}
                </dd>

                <dt>
                  <strong>{lang === 'ru' ? 'Цифровой контент' : 'Digital Content'}</strong>
                </dt>
                <dd>
                  {lang === 'ru'
                    ? '— цифровые материалы (например, аудиотреки/альбомы), предоставляемые Покупателю в электронной форме (скачивание и/или доступ в личном кабинете).'
                    : '— digital materials (e.g., audio tracks/albums) provided to the Buyer in electronic form (download and/or access in personal account).'}
                </dd>

                <dt>
                  <strong>{lang === 'ru' ? 'Заказ' : 'Order'}</strong>
                </dt>
                <dd>
                  {lang === 'ru'
                    ? '— оформленный Покупателем запрос на покупку Товара и/или Цифрового контента.'
                    : "— Buyer's request for purchase of Product and/or Digital Content."}
                </dd>
              </dl>
            </section>

            <section className="offer-page__section">
              <h2 className="offer-page__section-title">
                {lang === 'ru' ? '2. Общие положения' : '2. General Provisions'}
              </h2>
              <p>
                {lang === 'ru' ? (
                  <>
                    2.1. Продавец предлагает любому лицу заключить договор на условиях настоящей
                    Оферты. Акцепт Оферты означает, что Покупатель ознакомился и согласен со всеми
                    условиями.
                  </>
                ) : (
                  <>
                    2.1. The Seller offers any person to conclude an agreement on the terms of this
                    Offer. Acceptance of the Offer means that the Buyer has read and agrees to all
                    terms.
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    2.2. Акцептом Оферты является совершение Покупателем действий на Сайте,
                    направленных на оформление и оплату Заказа (нажатие кнопки «Оплатить», «Оформить
                    заказ» или аналогичной) и/или оплата Заказа.
                  </>
                ) : (
                  <>
                    2.2. Acceptance of the Offer is the Buyer's actions on the Website aimed at
                    placing and paying for the Order (clicking the "Pay", "Place Order" button or
                    similar) and/or payment of the Order.
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    2.3. Договор считается заключённым с момента получения Продавцом акцепта
                    (оплаты/подтверждения Заказа).
                  </>
                ) : (
                  <>
                    2.3. The agreement is considered concluded from the moment the Seller receives
                    acceptance (payment/confirmation of the Order).
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    2.4. Продавец вправе изменять Оферту. Новая редакция действует с момента
                    публикации на Сайте и применяется к Заказам, оформленным после публикации.
                  </>
                ) : (
                  <>
                    2.4. The Seller has the right to change the Offer. The new version comes into
                    effect from the moment of publication on the Website and applies to Orders
                    placed after publication.
                  </>
                )}
              </p>
            </section>

            <section className="offer-page__section">
              <h2 className="offer-page__section-title">
                {lang === 'ru' ? '3. Предмет договора' : '3. Subject of the Agreement'}
              </h2>
              <p>
                {lang === 'ru' ? (
                  <>
                    3.1. Продавец обязуется: передать Покупателю Товар (мерч) дистанционным
                    способом, и/или предоставить Покупателю Цифровой контент, а Покупатель обязуется
                    оплатить Заказ на условиях Оферты.
                  </>
                ) : (
                  <>
                    3.1. The Seller undertakes to: deliver the Product (merchandise) to the Buyer
                    remotely, and/or provide the Buyer with Digital Content, and the Buyer
                    undertakes to pay for the Order under the terms of the Offer.
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    3.2. Продажа товаров дистанционным способом осуществляется в соответствии с
                    действующими правилами продажи товаров (в т.ч. при дистанционном способе).
                  </>
                ) : (
                  <>
                    3.2. Remote sale of goods is carried out in accordance with the current rules
                    for the sale of goods (including remote sales).
                  </>
                )}
              </p>
            </section>

            <section className="offer-page__section">
              <h2 className="offer-page__section-title">
                {lang === 'ru' ? '4. Оформление заказа' : '4. Order Placement'}
              </h2>
              <p>
                {lang === 'ru' ? (
                  <>
                    4.1. Для оформления Заказа Покупатель указывает необходимые данные (например:
                    имя, e-mail, телефон, адрес доставки для мерча).
                  </>
                ) : (
                  <>
                    4.1. To place an Order, the Buyer provides the necessary data (e.g., name,
                    e-mail, phone, delivery address for merchandise).
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>4.2. Покупатель несёт ответственность за корректность введённых данных.</>
                ) : (
                  <>4.2. The Buyer is responsible for the accuracy of the entered data.</>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>4.3. Продавец вправе уточнить детали Заказа по указанным контактам.</>
                ) : (
                  <>
                    4.3. The Seller has the right to clarify Order details using the provided
                    contacts.
                  </>
                )}
              </p>
            </section>

            <section className="offer-page__section">
              <h2 className="offer-page__section-title">
                {lang === 'ru' ? '5. Цена и оплата' : '5. Price and Payment'}
              </h2>
              <p>
                {lang === 'ru' ? (
                  <>
                    5.1. Цена Товара/Цифрового контента указывается на Сайте в рублях РФ (если не
                    указано иное).
                  </>
                ) : (
                  <>
                    5.1. The price of Product/Digital Content is indicated on the Website in Russian
                    rubles (unless otherwise stated).
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    5.2. Оплата производится безналичным способом через платёжные сервисы, доступные
                    на Сайте.
                  </>
                ) : (
                  <>
                    5.2. Payment is made by non-cash method through payment services available on
                    the Website.
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    5.3. Моментом оплаты считается поступление денежных средств Продавцу/платёжному
                    провайдеру.
                  </>
                ) : (
                  <>
                    5.3. The moment of payment is considered the receipt of funds by the
                    Seller/payment provider.
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    5.4. Продавец вправе предоставлять скидки и промокоды. Условия скидок
                    указываются на Сайте.
                  </>
                ) : (
                  <>
                    5.4. The Seller has the right to provide discounts and promo codes. Discount
                    terms are indicated on the Website.
                  </>
                )}
              </p>
            </section>

            <section className="offer-page__section">
              <h2 className="offer-page__section-title">
                {lang === 'ru'
                  ? '6. Предоставление цифрового контента (треки/альбомы)'
                  : '6. Provision of Digital Content (tracks/albums)'}
              </h2>
              <p>
                {lang === 'ru' ? (
                  <>
                    6.1. Цифровой контент предоставляется одним из способов (указывается Продавцом
                    на Сайте): — ссылка для скачивания; и/или — доступ в личном кабинете; и/или —
                    иной электронный способ.
                  </>
                ) : (
                  <>
                    6.1. Digital Content is provided in one of the following ways (indicated by the
                    Seller on the Website): — download link; and/or — access in personal account;
                    and/or — other electronic method.
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    6.2. Срок предоставления доступа: как правило, сразу после подтверждения оплаты,
                    если на странице товара не указано иное.
                  </>
                ) : (
                  <>
                    6.2. Access provision period: as a rule, immediately after payment confirmation,
                    unless otherwise indicated on the product page.
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    6.3. Покупателю предоставляется неисключительное право личного использования
                    Цифрового контента. Запрещается распространение, перепродажа, публичная раздача
                    ссылок, загрузка в пиратские каталоги и иное использование, нарушающее права
                    правообладателя.
                  </>
                ) : (
                  <>
                    6.3. The Buyer is granted a non-exclusive right to personal use of Digital
                    Content. Distribution, resale, public sharing of links, uploading to pirate
                    catalogs and other use that violates the rights of the copyright holder is
                    prohibited.
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    6.4. Если после оплаты доступ к Цифровому контенту не предоставлен по
                    технической причине, Покупатель вправе обратиться в поддержку, и Продавец
                    обязуется устранить проблему либо вернуть оплату за непредоставленный контент.
                  </>
                ) : (
                  <>
                    6.4. If access to Digital Content is not provided after payment due to a
                    technical reason, the Buyer has the right to contact support, and the Seller
                    undertakes to resolve the problem or refund the payment for the unprovided
                    content.
                  </>
                )}
              </p>
            </section>

            <section className="offer-page__section">
              <h2 className="offer-page__section-title">
                {lang === 'ru'
                  ? '7. Доставка мерча (физических товаров)'
                  : '7. Merchandise Delivery (Physical Products)'}
              </h2>
              <p>
                {lang === 'ru' ? (
                  <>
                    7.1. Способы и стоимость доставки указываются при оформлении Заказа (или на
                    странице «Доставка»).
                  </>
                ) : (
                  <>
                    7.1. Delivery methods and cost are indicated when placing the Order (or on the
                    "Delivery" page).
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    7.2. Риск случайной гибели/повреждения Товара переходит к Покупателю в момент
                    передачи Товара службе доставки, если иное не предусмотрено законом или
                    условиями доставки.
                  </>
                ) : (
                  <>
                    7.2. The risk of accidental loss/damage of the Product passes to the Buyer at
                    the moment of transfer of the Product to the delivery service, unless otherwise
                    provided by law or delivery terms.
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    7.3. При получении Товара Покупатель обязан проверить целостность упаковки и
                    комплектность.
                  </>
                ) : (
                  <>
                    7.3. Upon receipt of the Product, the Buyer must check the integrity of the
                    packaging and completeness.
                  </>
                )}
              </p>
            </section>

            <section className="offer-page__section">
              <h2 className="offer-page__section-title">
                {lang === 'ru'
                  ? '8. Возврат и отказ от заказа (мерч)'
                  : '8. Return and Order Cancellation (Merchandise)'}
              </h2>
              <p>
                {lang === 'ru' ? (
                  <>
                    8.1. Покупатель вправе отказаться от Товара в любое время до его передачи, а
                    после передачи — в течение 7 дней.
                  </>
                ) : (
                  <>
                    8.1. The Buyer has the right to refuse the Product at any time before its
                    transfer, and after transfer — within 7 days.
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    8.2. Если информация о порядке и сроках возврата Товара надлежащего качества не
                    была предоставлена в письменной форме в момент доставки, Покупатель вправе
                    отказаться от Товара в течение 3 месяцев с момента передачи.
                  </>
                ) : (
                  <>
                    8.2. If information about the procedure and terms of return of goods of proper
                    quality was not provided in writing at the time of delivery, the Buyer has the
                    right to refuse the Product within 3 months from the moment of transfer.
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    8.3. Возврат Товара надлежащего качества возможен при сохранении товарного вида
                    и потребительских свойств, а также при наличии подтверждения покупки
                    (чек/электронный чек/подтверждение заказа), если иное не установлено законом.
                  </>
                ) : (
                  <>
                    8.3. Return of goods of proper quality is possible while maintaining the
                    presentation and consumer properties, as well as with proof of purchase
                    (receipt/electronic receipt/order confirmation), unless otherwise established by
                    law.
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    8.4. Возврат денежных средств осуществляется тем же способом, которым была
                    произведена оплата, в разумный срок после получения Продавцом возвращённого
                    Товара и проверки его состояния (если возврат применим).
                  </>
                ) : (
                  <>
                    8.4. Refund is made by the same method as payment was made, within a reasonable
                    time after the Seller receives the returned Product and checks its condition (if
                    return is applicable).
                  </>
                )}
              </p>
            </section>

            <section className="offer-page__section">
              <h2 className="offer-page__section-title">
                {lang === 'ru'
                  ? '9. Возврат и претензии (цифровой контент)'
                  : '9. Return and Claims (Digital Content)'}
              </h2>
              <p>
                {lang === 'ru' ? (
                  <>
                    9.1. В силу особенностей цифрового контента (электронная форма, моментальное
                    предоставление) возврат оплаты за контент надлежащего качества, к которому
                    Покупателю уже предоставлен доступ/скачивание, как правило, не производится,
                    кроме случаев, когда контент фактически не был предоставлен или имеет
                    существенные технические недостатки (файл не открывается, повреждён и т.п.).
                  </>
                ) : (
                  <>
                    9.1. Due to the specifics of digital content (electronic form, instant
                    provision), refund for content of proper quality to which the Buyer has already
                    been granted access/download is generally not made, except in cases where the
                    content was not actually provided or has significant technical defects (file
                    does not open, is corrupted, etc.).
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    9.2. Претензии по качеству цифрового контента направляются на e-mail поддержки:
                    support@smolyanoechuchelko.ru. Продавец рассматривает обращение и предлагает
                    решение (замена файла/повторное предоставление доступа/возврат оплаты — если
                    контент не предоставлен либо неисправим).
                  </>
                ) : (
                  <>
                    9.2. Claims regarding the quality of digital content should be sent to support
                    email: support@smolyanoechuchelko.ru. The Seller reviews the request and offers
                    a solution (file replacement/re-provision of access/refund — if the content was
                    not provided or is irreparable).
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    9.3. Неподходящий "вкус/ожидания" (например, «не понравилась песня») не является
                    недостатком цифрового контента.
                  </>
                ) : (
                  <>
                    9.3. Unsuitable "taste/expectations" (e.g., "didn't like the song") is not a
                    defect of digital content.
                  </>
                )}
              </p>
            </section>

            <section className="offer-page__section">
              <h2 className="offer-page__section-title">
                {lang === 'ru' ? '10. Персональные данные' : '10. Personal Data'}
              </h2>
              <p>
                {lang === 'ru' ? (
                  <>
                    10.1. Предоставляя данные при оформлении Заказа, Покупатель даёт согласие на
                    обработку персональных данных для исполнения договора и доставки Заказа.
                  </>
                ) : (
                  <>
                    10.1. By providing data when placing an Order, the Buyer gives consent to the
                    processing of personal data for the execution of the agreement and delivery of
                    the Order.
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    10.2. Согласие на обработку персональных данных оформляется отдельно от иных
                    документов/подтверждений (например, отдельным чекбоксом при оформлении Заказа).
                  </>
                ) : (
                  <>
                    10.2. Consent to the processing of personal data is issued separately from other
                    documents/confirmations (e.g., a separate checkbox when placing an Order).
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    10.3. Подробные условия обработки персональных данных размещаются в Политике
                    конфиденциальности на Сайте: [ссылка на страницу политики].
                  </>
                ) : (
                  <>
                    10.3. Detailed terms of personal data processing are posted in the Privacy
                    Policy on the Website: [link to policy page].
                  </>
                )}
              </p>
            </section>

            <section className="offer-page__section">
              <h2 className="offer-page__section-title">
                {lang === 'ru'
                  ? '11. Ответственность и форс-мажор'
                  : '11. Liability and Force Majeure'}
              </h2>
              <p>
                {lang === 'ru' ? (
                  <>11.1. Стороны несут ответственность в соответствии с законодательством РФ.</>
                ) : (
                  <>
                    11.1. The parties are liable in accordance with the legislation of the Russian
                    Federation.
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    11.2. Продавец не несёт ответственности за невозможность использования Цифрового
                    контента по причинам на стороне Покупателя (нет интернета, несовместимое ПО,
                    заблокирован e-mail и т.п.).
                  </>
                ) : (
                  <>
                    11.2. The Seller is not responsible for the inability to use Digital Content due
                    to reasons on the Buyer's side (no internet, incompatible software, blocked
                    e-mail, etc.).
                  </>
                )}
              </p>
              <p>
                {lang === 'ru' ? (
                  <>
                    11.3. Стороны освобождаются от ответственности за неисполнение обязательств при
                    наступлении обстоятельств непреодолимой силы (форс-мажор) на период их действия.
                  </>
                ) : (
                  <>
                    11.3. The parties are released from liability for non-performance of obligations
                    in the event of force majeure circumstances for the period of their action.
                  </>
                )}
              </p>
            </section>

            <section className="offer-page__section">
              <h2 className="offer-page__section-title">
                {lang === 'ru'
                  ? '12. Контакты и реквизиты Продавца'
                  : '12. Seller Contact Information and Details'}
              </h2>
              <div className="offer-page__seller-info">
                <p>
                  <strong>{lang === 'ru' ? 'Продавец:' : 'Seller:'}</strong> Самозанятое лицо
                </p>
                <p>
                  <strong>ИНН:</strong> 026305225147
                </p>
                <p>
                  <strong>{lang === 'ru' ? 'E-mail поддержки:' : 'Support e-mail:'}</strong>{' '}
                  support@smolyanoechuchelko.ru
                </p>
                <p>
                  <strong>{lang === 'ru' ? 'Часы поддержки:' : 'Support hours:'}</strong>{' '}
                  {lang === 'ru' ? '10:00–19:00 МСК' : '10:00–19:00 MSK'}
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
