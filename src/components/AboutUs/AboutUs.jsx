import { useState } from "react";

export default function AboutUs() {
  const [activeIndex, setActiveIndex] = useState(null);

  function handleClick() {
    setActiveIndex(!activeIndex);
  }

  return (
    <section className="b-about-us">
      <div className="row">
        <div className="small-12 column">
          <h2>О группе</h2>
          <p className={activeIndex ? "active" : null}>
            Смоляное чучелко&nbsp;&mdash; это музыкальный проект, звучание
            которого возвращает саунд Nirvana вопреки модным и&nbsp;текущим
            тенденциям в&nbsp;современной рок-музыке. Название 'Смоляное
            чучелко' образовано от&nbsp;американского термина 'tar-baby',
            относящегося к&nbsp;проблемной ситуации, которая лишь усугубляется
            при попытках взаимодействия с&nbsp;ней.
          </p>
          <button onClick={handleClick}>
            Показать <span>{activeIndex ? "меньше" : "больше"}</span>
            <span className="icon-ctrl"></span>
          </button>
        </div>
      </div>
    </section>
  );
}
