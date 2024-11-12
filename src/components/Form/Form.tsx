import React, { useState, FormEvent, ChangeEvent } from "react";
import { IAlbums } from "../../models";
import axios, { AxiosError } from "axios";
import { ErrorMessage } from "../ErrorMessage/ErrorMessage";

const productData = {
  title: "test product",
  price: 13.5,
  description: "lorem ipsum set",
  image: "https://i.pravatar.cc",
  category: "electronic",
};

export default function Form() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const submitHandler = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (value.trim().length === 0) {
      setError("Пожалуйста введите корректный заголовок");
      return;
    }

    productData.title = value;

    const response = await axios.post<IAlbums>(
      "https://fakestoreapi.com/products",
      productData,
    );
  };

  const changeHandler = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.currentTarget.value);
  };

  return (
    <section className="about-us">
      <div className="row">
        <div className="small-12 column">
          <h2>Форма</h2>
          <form onSubmit={submitHandler}>
            <input
              type="text"
              placeholder="Введите название песни"
              value={value}
              onChange={changeHandler}
            />

            {error && <ErrorMessage error={error} />}

            <button type="submit">Найти</button>
          </form>
        </div>
      </div>
    </section>
  );
}
